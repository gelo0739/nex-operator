import { useEffect, useState } from 'react';
import {
  Archive,
  ChevronDown,
  ClipboardList,
  ListFilter,
  PackageCheck,
  PackageSearch,
  RefreshCw,
  Route as RouteIcon,
} from 'lucide-react';
import MainLayout from '../components/MainLayout';
import LostItemStatusBadge from '../components/LostItemStatusBadge';
import LostItemDetailsModal from '../components/LostItemDetailsModal';
import Pagination from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import useRoutes from '../hooks/useRoutes';
import useLostItemChanges from '../hooks/useLostItemChanges';
import useCursorPagination from '../hooks/useCursorPagination';
import {
  LOST_ITEM_STATUSES,
  fetchLostItemCount,
  fetchLostItemPage,
  lostItemRef,
  lostItemStatus,
} from '../utils/lostItems';
import { formatDateTime24, loadErrorMessage } from '../utils/format';
import { routeLabel, shortRouteName } from '../utils/routes';

const PAGE_SIZE = 5;
const EMPTY_FILTERS = { routeId: '', status: '' };
const NUMBER = new Intl.NumberFormat('en-US');

const selectClass =
  'h-10 appearance-none rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer';

// Header cards, one per status. Clicking a card filters the table to that
// status; clicking it again shows all reports.
const STAT_CARDS = [
  { status: 'PENDING', label: 'Pending Reports', icon: ClipboardList, accent: 'border-l-amber-400', chip: 'bg-amber-100 text-amber-600' },
  { status: 'FOUND', label: 'Item Found', icon: PackageSearch, accent: 'border-l-blue-500', chip: 'bg-blue-100 text-blue-600', note: 'Located, awaiting pickup' },
  { status: 'RETURNED', label: 'Returned', icon: PackageCheck, accent: 'border-l-emerald-500', chip: 'bg-emerald-100 text-emerald-600', note: 'Back with the owner' },
  { status: 'CLOSED', label: 'Closed', icon: Archive, accent: 'border-l-slate-400', chip: 'bg-slate-100 text-slate-600', note: 'Closed without return' },
];
const COUNTED_STATUSES = ['PENDING', 'FOUND', 'RETURNED', 'CLOSED'];

function StatCard({ card, value, note, active, onClick }) {
  const Icon = card.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={active ? 'Show all reports' : `Show only ${card.label.replace(/ Reports$/, '')} reports`}
      className={`text-left bg-white rounded-2xl border border-slate-200/60 border-l-4 ${card.accent} shadow-sm p-5 flex items-start justify-between gap-3 transition-shadow hover:shadow-md cursor-pointer ${
        active ? 'ring-2 ring-blue-500/30' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{card.label}</p>
        <p className="mt-2 text-4xl font-black text-slate-950 tracking-tight">{value === null ? '–' : NUMBER.format(value)}</p>
        <p className="mt-1 text-xs text-slate-500 min-h-4">{note}</p>
      </div>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${card.chip}`}>
        <Icon className="w-5 h-5" />
      </div>
    </button>
  );
}

/** Select with a leading icon and a chevron, styled like the mockup's "All Routes" dropdown. */
function IconSelect({ icon: Icon, label, value, onChange, children }) {
  return (
    <div className="relative">
      <Icon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {children}
      </select>
      <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

export default function LostItemReports() {
  const { busLine } = useAuth();
  // useRoutes only returns routes on the operator's line, so the filter never
  // offers another line's routes.
  const { routes } = useRoutes(busLine);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [reloadToken, setReloadToken] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const queryKey = JSON.stringify([busLine, filters, reloadToken]);
  const {
    items: pageItems,
    loading: pageLoading,
    error: pageError,
    knownPages,
    patchItem,
  } = useCursorPagination({
    enabled: Boolean(busLine),
    queryKey,
    page,
    pageSize: PAGE_SIZE,
    fetchPage: (cursor, size) => fetchLostItemPage(busLine, filters, cursor, size),
    label: 'lost item reports',
  });

  // Header-card counts: the total plus one per status, all server-side count()
  // aggregations. They follow the route filter but not the status filter (so
  // picking a status doesn't zero the other cards), which is why they're keyed
  // on the route only. `recount` re-runs them after a status change without
  // blanking the numbers (same key until the new ones arrive).
  const countKey = JSON.stringify([busLine, filters.routeId, reloadToken]);
  const [recount, setRecount] = useState(0);
  // Live: any status change or new report on the line (from any tab, operator
  // or the NEX app) re-runs the counts and patches visible rows.
  const { version: changeVersion, changed: changedReports } = useLostItemChanges(busLine);
  const [countState, setCountState] = useState({ key: null, counts: null, error: null });
  useEffect(() => {
    if (!busLine) return undefined;
    let cancelled = false;
    const routeId = filters.routeId;
    Promise.all([
      fetchLostItemCount(busLine, { routeId }),
      ...COUNTED_STATUSES.map((status) => fetchLostItemCount(busLine, { routeId, status })),
    ])
      .then(([total, ...byStatus]) => {
        if (cancelled) return;
        const counts = { total };
        COUNTED_STATUSES.forEach((status, i) => {
          counts[status] = byStatus[i];
        });
        setCountState({ key: countKey, counts, error: null });
      })
      .catch((error) => {
        console.error('Failed to count lost item reports:', error);
        if (!cancelled) setCountState({ key: countKey, counts: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, [busLine, countKey, recount, changeVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply live status changes made elsewhere to the rows on screen.
  const items = pageItems.map((r) => (changedReports[r.id] ? { ...r, ...changedReports[r.id] } : r));

  const countLoading = countState.key !== countKey;
  const counts = countLoading ? null : countState.counts;
  // Table / pagination total: the status filter picks the matching card's count.
  const total = counts ? ((filters.status ? counts[filters.status] : counts.total) ?? 0) : null;
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE));
  const firstShown = items.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastShown = (page - 1) * PAGE_SIZE + items.length;
  const filtered = Boolean(filters.routeId || filters.status);

  const updateFilter = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const refresh = () => {
    setReloadToken((t) => t + 1);
    setPage(1);
  };

  // After the modal saves a status, update the row and the modal's copy in
  // place, and recount (the pending figure / status-filtered total change).
  const handleStatusSaved = (id, patch) => {
    patchItem(id, patch);
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
    setRecount((n) => n + 1);
  };

  return (
    <MainLayout pageTitle="Lost Item Management" pageSubtitle="Track, manage and resolve lost property across all fleet routes.">
      {/* STAT CARDS — click to filter by status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {STAT_CARDS.map((card) => {
          const value = counts ? counts[card.status] ?? 0 : null;
          const active = filters.status === card.status;
          let note = card.note;
          if (card.status === 'PENDING') {
            // No caption on the pending card — only an error, if counting failed.
            note =
              !countLoading && countState.error ? (
                <span className="text-amber-700">{loadErrorMessage(countState.error, 'totals')}</span>
              ) : null;
          }
          return (
            <StatCard
              key={card.label}
              card={card}
              value={value}
              note={note}
              active={active}
              onClick={() => updateFilter({ status: active ? '' : card.status })}
            />
          );
        })}
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <IconSelect icon={RouteIcon} label="Filter by route" value={filters.routeId} onChange={(routeId) => updateFilter({ routeId })}>
          <option value="">All Routes</option>
          {routes.map((route) => (
            <option key={route.id} value={route.id}>
              {routeLabel(route)}
            </option>
          ))}
        </IconSelect>
        <IconSelect icon={ListFilter} label="Filter by status" value={filters.status} onChange={(status) => updateFilter({ status })}>
          <option value="">All Statuses</option>
          {LOST_ITEM_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </IconSelect>
        {filtered && (
          <button onClick={() => updateFilter(EMPTY_FILTERS)} className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 cursor-pointer">
            Clear
          </button>
        )}
        <button
          onClick={refresh}
          title="Refresh"
          aria-label="Refresh"
          className="ml-auto p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-fixed min-w-[720px]">
            <colgroup>
              <col className="w-[160px]" />
              <col />
              <col className="w-[200px]" />
              <col className="w-[120px]" />
            </colgroup>
            <thead className="bg-[#eef1fb] border-b border-slate-200/70">
              <tr className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider">
                <th className="px-5 py-3.5">Date Reported</th>
                <th className="px-5 py-3.5">Item ID &amp; Description</th>
                <th className="px-5 py-3.5">Trip / Route</th>
                <th className="px-5 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((report) => (
                <tr key={report.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-5 text-sm text-slate-900 whitespace-nowrap">{formatDateTime24(report.createdAt)}</td>
                  <td className="px-5 py-5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-slate-950">ID: #{lostItemRef(report.id)}</p>
                      <LostItemStatusBadge status={lostItemStatus(report)} />
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5" title={report.description}>
                      {report.category ? `${report.category} · ` : ''}
                      {report.description || '—'}
                    </p>
                  </td>
                  <td className="px-5 py-5 text-sm text-slate-800 truncate" title={report.routeName}>
                    {shortRouteName(report.routeName)}
                  </td>
                  <td className="px-5 py-5 text-center">
                    <button
                      onClick={() => setSelected(report)}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-14 text-center">
                    {pageLoading ? (
                      <p className="text-sm text-slate-500">Loading reports…</p>
                    ) : pageError ? (
                      <p className="text-sm font-semibold text-red-600">{loadErrorMessage(pageError, 'reports')}</p>
                    ) : (
                      <>
                        <div className="w-12 h-12 mx-auto mb-3 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                          <PackageSearch className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {filtered ? 'No reports match these filters' : 'No lost item reports yet'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {filtered
                            ? 'Try another route or status.'
                            : 'Reports filed in the NEX app for your routes will appear here.'}
                        </p>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          knownPages={knownPages}
          onPageChange={setPage}
          className="border-t border-slate-200/70"
          summary={
            <p className="text-xs text-slate-600">
              Showing <span className="font-semibold text-slate-900">{firstShown}-{lastShown}</span> of{' '}
              <span className="font-semibold text-slate-900">{total === null ? '…' : NUMBER.format(total)}</span> reports
            </p>
          }
        />
      </div>

      {selected && (
        <LostItemDetailsModal
          key={selected.id}
          report={selected}
          onClose={() => setSelected(null)}
          onStatusSaved={(patch) => handleStatusSaved(selected.id, patch)}
        />
      )}
    </MainLayout>
  );
}
