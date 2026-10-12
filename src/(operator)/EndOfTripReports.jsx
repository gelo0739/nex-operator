import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BusFront, Download, ListFilter, Loader2, MapPinned, RefreshCw, Timer, X } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import TripReportModal from '../components/TripReportModal';
import FilterField, { FILTER_CONTROL_CLASS } from '../components/FilterField';
import { useAuth } from '../context/AuthContext';
import useRoutes from '../hooks/useRoutes';
import useConductors from '../hooks/useConductors';
import useBuses from '../hooks/useBuses';
import {
  EXPORT_MAX_TRIPS,
  buildTripsCsv,
  downloadCsv,
  fetchAllTrips,
  fetchTripPage,
  fetchTripStats,
  initials,
  shortName,
  tripRef,
} from '../utils/trips';
import { formatDate, formatDuration, formatTime24, loadErrorMessage } from '../utils/format';
import { routeLabel, shortRouteName } from '../utils/routes';

const PAGE_SIZE = 10;
const EMPTY_FILTERS = { routeId: '', busId: '', conductorId: '', from: '', to: '' };
const NUMBER = new Intl.NumberFormat('en-US');

export default function EndOfTripReports() {
  const { busLine } = useAuth();
  const { routes } = useRoutes(busLine); // only routes on the operator's line
  const { conductors } = useConductors(busLine);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [selected, setSelected] = useState(null);

  // Results are keyed by the request that produced them, so a late response
  // for old filters can never overwrite newer results.
  const queryKey = JSON.stringify([busLine, filters, reloadToken]);

  // ---- bus list for the filter: this line's buses ---------------------------
  const { buses: lineBuses } = useBuses(busLine);
  const buses = lineBuses.map((b) => b.busNumber).filter(Boolean);

  // ---- trips: first batch, then "Load More" appends --------------------------
  const [listState, setListState] = useState({ key: null, items: [], lastDoc: null, done: false, error: null });
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    if (!busLine) return undefined;
    let cancelled = false;
    fetchTripPage(busLine, filters, null, PAGE_SIZE)
      .then(({ items, lastDoc }) => {
        if (!cancelled) setListState({ key: queryKey, items, lastDoc, done: items.length < PAGE_SIZE, error: null });
      })
      .catch((error) => {
        console.error('Failed to load trips:', error);
        if (!cancelled) setListState({ key: queryKey, items: [], lastDoc: null, done: true, error });
      });
    return () => {
      cancelled = true;
    };
    // filters are encoded in queryKey.
  }, [busLine, queryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    if (loadingMore || listState.done || listState.key !== queryKey) return;
    const requestKey = queryKey;
    setLoadingMore(true);
    try {
      const { items, lastDoc } = await fetchTripPage(busLine, filters, listState.lastDoc, PAGE_SIZE);
      setListState((prev) =>
        prev.key === requestKey
          ? { ...prev, items: [...prev.items, ...items], lastDoc: lastDoc ?? prev.lastDoc, done: items.length < PAGE_SIZE }
          : prev,
      );
    } catch (error) {
      console.error('Failed to load more trips:', error);
      setListState((prev) => (prev.key === requestKey ? { ...prev, error } : prev));
    } finally {
      setLoadingMore(false);
    }
  };

  // ---- stats (server-side count + average) -----------------------------------
  const [statsState, setStatsState] = useState({ key: null, data: null, error: null });
  useEffect(() => {
    if (!busLine) return undefined;
    let cancelled = false;
    fetchTripStats(busLine, filters)
      .then((data) => !cancelled && setStatsState({ key: queryKey, data, error: null }))
      .catch((error) => {
        console.error('Failed to load trip stats:', error);
        if (!cancelled) setStatsState({ key: queryKey, data: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, [busLine, queryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- derived view state ----------------------------------------------------
  const listLoading = listState.key !== queryKey;
  const items = listLoading ? [] : listState.items;
  const listError = listLoading ? null : listState.error;

  const statsLoading = statsState.key !== queryKey;
  const stats = statsLoading ? null : statsState.data;
  const total = stats?.total ?? null;

  const conductorNames = new Map(conductors.map((c) => [c.id, c.name || c.email]));
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const canLoadMore = !listLoading && !listState.done && items.length > 0 && (total === null || items.length < total);

  const updateFilter = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const refresh = () => setReloadToken((t) => t + 1);

  // ---- infinite scroll ----------------------------------------------------------
  // A sentinel at the bottom of the scrollable table loads the next batch when
  // it scrolls into view. The "Load More" button stays as a fallback.
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });
  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !canLoadMore || loadingMore) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMoreRef.current();
      },
      { root, rootMargin: '0px 0px 160px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, loadingMore, items.length]);

  // ---- CSV export ---------------------------------------------------------------
  const [exporting, setExporting] = useState(null); // null | number of trips fetched so far
  const [exportError, setExportError] = useState(null);
  const exportCsv = async () => {
    if (exporting !== null || !busLine) return;
    setExporting(0);
    setExportError(null);
    try {
      const trips = await fetchAllTrips(busLine, filters, (n) => setExporting(n));
      const csv = buildTripsCsv(trips, conductorNames);
      const today = new Date();
      const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const safeLine = String(busLine).replace(/[^A-Za-z0-9-]+/g, '-');
      downloadCsv(csv, `end-of-trip-reports_${safeLine}_${stamp}.csv`);
      if (trips.length >= EXPORT_MAX_TRIPS) {
        setExportError(`Export stopped at ${NUMBER.format(EXPORT_MAX_TRIPS)} trips — narrow the filters to export the rest.`);
      }
    } catch (error) {
      console.error('CSV export failed:', error);
      setExportError(loadErrorMessage(error, 'trips for export'));
    } finally {
      setExporting(null);
    }
  };

  return (
    <MainLayout pageTitle="End of Trip Reports" pageSubtitle="Completed trips reported by conductors on your routes.">
      {/* STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
          <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <BusFront className="w-5 h-5" />
          </div>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Trips Completed</p>
          <p className="mt-1">
            <span className="text-3xl font-black text-slate-950 tracking-tight">{statsLoading || total === null ? '–' : NUMBER.format(total)}</span>
            <span className="text-sm font-medium text-slate-500"> trips</span>
          </p>
          {!statsLoading && statsState.error && (
            <p className="mt-1 text-[11px] font-medium text-amber-700">{loadErrorMessage(statsState.error, 'totals')}</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
          <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <Timer className="w-5 h-5" />
          </div>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Average Trip Duration</p>
          <p className="mt-1 text-3xl font-black text-slate-950 tracking-tight">
            {statsLoading ? '–' : stats?.avgSeconds != null ? formatDuration(stats.avgSeconds) : '—'}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {stats?.avgError ? (
              <span className="font-medium text-amber-700">{loadErrorMessage(stats.avgError, 'the average')}</span>
            ) : (
              'Start to finish, per completed trip'
            )}
          </p>
        </div>
      </div>
      {activeFilterCount > 0 && <p className="-mt-3 text-xs text-slate-500">Totals reflect the active filters.</p>}

      {/* RECENT REPORTS */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-6 py-5">
          <h3 className="text-lg font-bold text-slate-950">Recent End of Trip Reports</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={exporting !== null || total === 0}
              title={`Download the trips matching the current filters as CSV (one read per trip, up to ${NUMBER.format(EXPORT_MAX_TRIPS)})`}
              className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting !== null ? `Exporting… ${NUMBER.format(exporting)}` : 'Export CSV'}
            </button>
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
          <div className="flex flex-wrap items-end gap-3 px-6 py-3 border-t border-slate-100 bg-slate-50/60">
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
            <FilterField label="Bus">
              <select value={filters.busId} onChange={(e) => updateFilter({ busId: e.target.value })} className={`${FILTER_CONTROL_CLASS} cursor-pointer`}>
                <option value="">All buses</option>
                {buses.map((bus) => (
                  <option key={bus} value={bus}>
                    {bus}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Conductor">
              <select
                value={filters.conductorId}
                onChange={(e) => updateFilter({ conductorId: e.target.value })}
                className={`${FILTER_CONTROL_CLASS} cursor-pointer`}
              >
                <option value="">All conductors</option>
                {conductors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.email}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="From">
              <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => updateFilter({ from: e.target.value })} className={FILTER_CONTROL_CLASS} />
            </FilterField>
            <FilterField label="To">
              <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => updateFilter({ to: e.target.value })} className={FILTER_CONTROL_CLASS} />
            </FilterField>
            {activeFilterCount > 0 && (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="flex items-center gap-1 h-9 text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
        )}

        {exportError && (
          <p className="px-6 pb-3 -mt-2 text-xs font-medium text-amber-700">{exportError}</p>
        )}

        {/* Scrollable table: sticky header, more trips load as you scroll. */}
        <div ref={scrollRef} className="max-h-[560px] overflow-auto overscroll-contain">
          <table className="w-full text-left table-fixed min-w-[820px]">
            <colgroup>
              <col className="w-[150px]" />
              <col className="w-[120px]" />
              <col />
              <col className="w-[110px]" />
              <col className="w-[190px]" />
              <col className="w-[150px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[#eef1fb] shadow-[0_1px_0_0_rgb(226_232_240)]">
              <tr className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider">
                <th className="px-6 py-3">Date / Time</th>
                <th className="px-4 py-3">Trip ID</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Bus #</th>
                <th className="px-4 py-3">Conductor</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((trip) => {
                const name = conductorNames.get(trip.conductorId);
                return (
                  <tr key={trip.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-900">{formatDate(trip.endTime)}</p>
                      <p className="text-[11px] text-slate-500">{formatTime24(trip.endTime)}</p>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-blue-700">{tripRef(trip.id)}</td>
                    <td className="px-4 py-4 text-sm text-slate-800 truncate" title={trip.route}>
                      {shortRouteName(trip.route, ' to ')}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-800">{trip.busId && trip.busId !== 'UNKNOWN' ? trip.busId : '—'}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 shrink-0 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center ring-1 ring-slate-200">
                          {name ? initials(name) : '?'}
                        </span>
                        <span className="text-sm text-slate-800 truncate" title={name}>
                          {name ? shortName(name) : 'Unknown conductor'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button onClick={() => setSelected(trip)} className="text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline cursor-pointer">
                        View Full Report
                      </button>
                    </td>
                  </tr>
                );
              })}

              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center">
                    {listLoading ? (
                      <p className="text-sm text-slate-500">Loading trips…</p>
                    ) : listError ? (
                      <p className="text-sm font-semibold text-red-600">{loadErrorMessage(listError, 'trips')}</p>
                    ) : (
                      <>
                        <div className="w-12 h-12 mx-auto mb-3 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                          <MapPinned className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {activeFilterCount > 0 ? 'No trips match these filters' : 'No completed trips yet'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {activeFilterCount > 0
                            ? 'Try another route, bus, conductor or date range.'
                            : 'Trips ended in the NEX conductor app appear here.'}
                        </p>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div ref={sentinelRef} aria-hidden className="h-px" />
          {loadingMore && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              Loading more trips…
            </div>
          )}
        </div>

        {/* LOAD MORE */}
        {items.length > 0 && (
          <div className="flex flex-col items-center gap-1 px-6 py-4 bg-[#eef1fb]/70">
            {canLoadMore ? (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800 cursor-pointer disabled:opacity-60"
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Load More Reports
                {!loadingMore && <ArrowRight className="w-4 h-4" />}
              </button>
            ) : (
              <p className="text-xs text-slate-500">All reports loaded</p>
            )}
            <p className="text-[11px] text-slate-500">
              Showing {NUMBER.format(items.length)}
              {total !== null && ` of ${NUMBER.format(total)}`} trips
            </p>
            {listError && items.length > 0 && <p className="text-[11px] font-medium text-red-600">{loadErrorMessage(listError, 'more trips')}</p>}
          </div>
        )}
      </div>

      {selected && (
        <TripReportModal
          key={selected.id}
          trip={selected}
          conductorName={conductorNames.get(selected.conductorId)}
          onClose={() => setSelected(null)}
        />
      )}
    </MainLayout>
  );
}
