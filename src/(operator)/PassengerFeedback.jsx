import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListFilter, MessageSquare, RefreshCw, TrendingDown, TrendingUp, X } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import StarRating from '../components/StarRating';
import CategoryPill from '../components/CategoryPill';
import FeedbackDetailsModal from '../components/FeedbackDetailsModal';
import FeedbackStatusBadge from '../components/FeedbackStatusBadge';
import FilterField, { FILTER_CONTROL_CLASS } from '../components/FilterField';
import Pagination from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import useRoutes from '../hooks/useRoutes';
import useCursorPagination from '../hooks/useCursorPagination';
import {
  FEEDBACK_STATUSES,
  FEEDBACK_TAGS,
  feedbackCategories,
  feedbackStatus,
  fetchFeedbackPage,
  fetchFeedbackStats,
  fetchFeedbackTrend,
  getFeedback,
} from '../utils/feedback';
import { formatDateTime, loadErrorMessage } from '../utils/format';
import { routeLabel } from '../utils/routes';

const PAGE_SIZE = 10;
const EMPTY_FILTERS = { status: '', routeId: '', category: '', from: '', to: '' };
const NUMBER = new Intl.NumberFormat('en-US');

export default function PassengerFeedback() {
  const { busLine } = useAuth();
  const { routes } = useRoutes(busLine);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  // Deep links from the notification bell: ?status=new presets the filter,
  // ?open=<id> opens that feedback. Applied once per URL, then cleared.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.toString();
  const [handledSearch, setHandledSearch] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [openError, setOpenError] = useState(null);
  if (search && search !== handledSearch) {
    setHandledSearch(search);
    const paramStatus = searchParams.get('status');
    if (paramStatus && FEEDBACK_STATUSES.some((s) => s.value === paramStatus)) {
      setFilters({ ...EMPTY_FILTERS, status: paramStatus });
      setPage(1);
      setShowFilters(true);
    }
    const paramOpen = searchParams.get('open');
    if (paramOpen) {
      setOpenId(paramOpen);
      setOpenError(null);
    }
  } else if (!search && handledSearch) {
    setHandledSearch(null);
  }
  useEffect(() => {
    if (search) setSearchParams({}, { replace: true });
  }, [search, setSearchParams]);

  useEffect(() => {
    if (!openId || !busLine) return undefined;
    let cancelled = false;
    getFeedback(openId, busLine)
      .then((feedback) => {
        if (cancelled) return;
        if (feedback) setSelected(feedback);
        else setOpenError('That feedback no longer exists.');
        setOpenId(null);
      })
      .catch((error) => {
        console.error('Failed to open feedback:', error);
        if (!cancelled) {
          setOpenError('Couldn’t open that feedback.');
          setOpenId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [openId, busLine]);

  // Everything fetched below is keyed by the request that produced it, so a
  // late response for old filters can never overwrite newer results.
  const queryKey = JSON.stringify([busLine, filters, reloadToken]);
  const {
    items,
    loading: pageLoading,
    error: pageError,
    knownPages,
    patchItem,
  } = useCursorPagination({
    enabled: Boolean(busLine),
    queryKey,
    page,
    pageSize: PAGE_SIZE,
    fetchPage: (cursor, size) => fetchFeedbackPage(busLine, filters, cursor, size),
    label: 'feedback',
  });

  // ---- stats (server-side aggregation) -------------------------------------
  const [statsState, setStatsState] = useState({ key: null, data: null, error: null });
  useEffect(() => {
    if (!busLine) return undefined;
    let cancelled = false;
    fetchFeedbackStats(busLine, filters)
      .then((data) => !cancelled && setStatsState({ key: queryKey, data, error: null }))
      .catch((error) => {
        console.error('Failed to load feedback stats:', error);
        if (!cancelled) setStatsState({ key: queryKey, data: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, [busLine, queryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trend ignores the date range, so it only refetches when route/category change.
  const trendKey = JSON.stringify([busLine, filters.routeId, filters.category, reloadToken]);
  const [trendState, setTrendState] = useState({ key: null, data: null });
  useEffect(() => {
    if (!busLine) return undefined;
    let cancelled = false;
    fetchFeedbackTrend(busLine, filters)
      .then((data) => !cancelled && setTrendState({ key: trendKey, data }))
      .catch((error) => {
        console.error('Failed to load feedback trend:', error);
        if (!cancelled) setTrendState({ key: trendKey, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [busLine, trendKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- derived view state --------------------------------------------------
  const statsLoading = statsState.key !== queryKey;
  const stats = statsLoading ? null : statsState.data;
  const total = stats?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const trend = trendState.key === trendKey ? trendState.data : null;
  const trendPercent =
    trend && trend.previous > 0 ? Math.round(((trend.recent - trend.previous) / trend.previous) * 100) : null;

  const firstShown = items.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastShown = (page - 1) * PAGE_SIZE + items.length;

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const updateFilter = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  // After a review is saved in the modal, update the row and the modal's copy.
  const handleReviewSaved = (id, patch) => {
    patchItem(id, patch);
    setSelected((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
  };

  const refresh = () => {
    setReloadToken((t) => t + 1);
    setPage(1);
  };

  return (
    <MainLayout pageTitle="Passenger Feedback Management" pageSubtitle="Review ratings and comments from commuters on your routes.">
      {/* STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 flex flex-col items-center text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Average Rating</p>
          <p className="mt-2">
            <span className="text-4xl font-black text-slate-950 tracking-tight">
              {statsLoading ? '–' : stats?.avgRating != null ? stats.avgRating.toFixed(1) : '—'}
            </span>
            <span className="text-sm font-semibold text-slate-400"> / 5</span>
          </p>
          <StarRating value={stats?.avgRating ?? 0} size="w-5 h-5" className="mt-2" />
          {(stats?.avgError || (!statsLoading && statsState.error)) && (
            <p className="mt-2 text-[11px] font-medium text-amber-700">
              {loadErrorMessage(stats?.avgError ?? statsState.error, 'the average')}
            </p>
          )}
          {!statsLoading && !stats?.avgError && !statsState.error && stats?.total === 0 && (
            <p className="mt-2 text-[11px] text-slate-400">No ratings yet</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 flex flex-col items-center text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Feedbacks</p>
          <p className="mt-2 text-4xl font-black text-slate-950 tracking-tight">{statsLoading ? '–' : NUMBER.format(total)}</p>
          <div className="mt-2 h-5 flex items-center">
            {trendPercent !== null && (
              <span
                className={`flex items-center gap-1 text-xs font-semibold ${trendPercent >= 0 ? 'text-blue-600' : 'text-amber-700'}`}
                title="Last 30 days vs the 30 days before"
              >
                {trendPercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {trendPercent >= 0 ? '+' : ''}
                {trendPercent}% vs previous 30 days
              </span>
            )}
          </div>
        </div>
      </div>
      {activeFilterCount > 0 && (
        <p className="-mt-3 text-xs text-slate-500">Stats reflect the active filters.</p>
      )}

      {/* RECENT FEEDBACK */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-auto mb-6">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-950">Recent Feedback</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              title="Refresh"
              aria-label="Refresh"
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg border transition-colors cursor-pointer ${
                showFilters || activeFilterCount > 0
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <ListFilter className="w-4 h-4" />
              Filter
              {activeFilterCount > 0 && (
                <span className="min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-end gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/60">
            <FilterField label="Status">
              <select value={filters.status} onChange={(e) => updateFilter({ status: e.target.value })} className={`${FILTER_CONTROL_CLASS} cursor-pointer`}>
                <option value="">All statuses</option>
                {FEEDBACK_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Route">
              <select value={filters.routeId} onChange={(e) => updateFilter({ routeId: e.target.value })} className={`${FILTER_CONTROL_CLASS} cursor-pointer`}>
                <option value="">All routes</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {routeLabel(route)}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Category">
              <select value={filters.category} onChange={(e) => updateFilter({ category: e.target.value })} className={`${FILTER_CONTROL_CLASS} cursor-pointer`}>
                <option value="">All categories</option>
                {FEEDBACK_TAGS.map((tag) => (
                  <option key={tag.label} value={tag.label}>
                    {tag.label}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="From">
              <input
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(e) => updateFilter({ from: e.target.value })}
                className={FILTER_CONTROL_CLASS}
              />
            </FilterField>
            <FilterField label="To">
              <input
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => updateFilter({ to: e.target.value })}
                className={FILTER_CONTROL_CLASS}
              />
            </FilterField>
            {activeFilterCount > 0 && (
              <button
                onClick={() => updateFilter(EMPTY_FILTERS)}
                className="flex items-center gap-1 h-9 text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
        )}

        {/* DYNAMIC SCROLL CONTAINER WITH STICKY HEADER */}
        <div className="overflow-x-auto max-h-[calc(100vh-430px)] min-h-[220px] overflow-y-auto">
          <table className="w-full text-left table-fixed min-w-[880px]">
            <colgroup>
              <col className="w-[160px]" />
              <col className="w-[115px]" />
              <col className="w-[150px]" />
              <col />
              <col className="w-[115px]" />
              <col className="w-[110px]" />
            </colgroup>
            <thead className="bg-[#eef1fb] border-y border-slate-200/70 sticky top-0 z-10">
              <tr className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider">
                <th className="px-5 py-3 text-center bg-[#eef1fb]">Date</th>
                <th className="px-5 py-3 bg-[#eef1fb]">Rating</th>
                <th className="px-5 py-3 bg-[#eef1fb]">Category</th>
                <th className="px-5 py-3 bg-[#eef1fb]">Comment</th>
                <th className="px-5 py-3 bg-[#eef1fb]">Status</th>
                <th className="px-5 py-3 text-center bg-[#eef1fb]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((feedback) => {
                const categories = feedbackCategories(feedback);
                return (
                  <tr key={feedback.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-5 text-sm font-medium text-slate-900 text-center whitespace-nowrap">
                      {formatDateTime(feedback.createdAt)}
                    </td>
                    <td className="px-5 py-5">
                      <StarRating value={feedback.rating} />
                    </td>
                    <td className="px-5 py-5">
                      {categories.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <CategoryPill label={categories[0]} />
                          {categories.length > 1 && (
                            <span className="text-[10px] font-semibold text-slate-400" title={categories.slice(1).join(', ')}>
                              +{categories.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-5">
                      <p className="text-sm text-slate-600 truncate" title={feedback.comment}>
                        {feedback.comment || '—'}
                      </p>
                    </td>
                    <td className="px-5 py-5">
                      <FeedbackStatusBadge status={feedbackStatus(feedback)} />
                    </td>
                    <td className="px-5 py-5 text-center">
                      <button
                        onClick={() => setSelected(feedback)}
                        className="text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })}

              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    {pageLoading ? (
                      <p className="text-sm text-slate-500">Loading feedback…</p>
                    ) : pageError ? (
                      <p className="text-sm font-semibold text-red-600">{loadErrorMessage(pageError, 'feedback')}</p>
                    ) : (
                      <>
                        <div className="w-12 h-12 mx-auto mb-3 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                          <MessageSquare className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {activeFilterCount > 0 ? 'No feedback matches these filters' : 'No feedback yet'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {activeFilterCount > 0
                            ? 'Try a different route, category or date range.'
                            : 'Feedback submitted in the NEX app for your routes will appear here.'}
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
          summary={
            <p className="text-xs font-semibold text-slate-700">
              {statsState.error && !statsLoading
                ? loadErrorMessage(statsState.error, 'totals')
                : `Showing ${firstShown} to ${lastShown} of ${statsLoading ? '…' : NUMBER.format(total)} entries`}
            </p>
          }
        />
      </div>

      {openError && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 rounded-xl bg-slate-900 text-white text-xs font-medium px-4 py-3 shadow-lg">
          {openError}
          <button onClick={() => setOpenError(null)} aria-label="Dismiss" className="text-slate-300 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {selected && (
        <FeedbackDetailsModal
          key={selected.id}
          feedback={selected}
          onClose={() => setSelected(null)}
          onReviewSaved={(patch) => handleReviewSaved(selected.id, patch)}
        />
      )}
    </MainLayout>
  );
}
