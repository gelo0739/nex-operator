import { useState } from 'react';
import { BusFront, CheckCircle2, FilePenLine, Filter, Plus, Search, UserRound, Users, X } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import ConductorFormModal from '../components/ConductorFormModal';
import { useAuth } from '../context/AuthContext';
import useConductors from '../hooks/useConductors';
import useActiveBuses from '../hooks/useActiveBuses';
import useRoutes from '../hooks/useRoutes';

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active on Route' },
  { value: 'inactive', label: 'Inactive' },
];
const EMPTY_FILTERS = { name: '', routeId: 'all', status: 'all' };

const selectClass =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer';

// Page buttons like [1, 2, 3, '…', 14], always showing the first, last and
// the current page's neighbours.
function pageItems(current, total) {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const items = [];
  sorted.forEach((page, i) => {
    if (i > 0 && page - sorted[i - 1] > 1) items.push(`gap-${page}`);
    items.push(page);
  });
  return items;
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold ${
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {active ? 'Active on Route' : 'Inactive'}
    </span>
  );
}

export default function ManageConductors() {
  const { busLine } = useAuth();
  const { conductors, loading, error } = useConductors(busLine);
  const activeByConductor = useActiveBuses();
  const { routes } = useRoutes(busLine);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // null | { mode: 'add' } | { mode: 'edit', conductorId }

  const activeCount = conductors.filter((c) => activeByConductor.has(c.id)).length;

  const search = filters.name.trim().toLowerCase();
  const filtered = conductors.filter((conductor) => {
    const assignment = activeByConductor.get(conductor.id);
    if (search) {
      const haystack = `${conductor.name ?? ''} ${conductor.email ?? ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.status === 'active' && !assignment) return false;
    if (filters.status === 'inactive' && assignment) return false;
    if (filters.routeId !== 'all' && assignment?.routeId !== filters.routeId) return false;
    return true;
  });

  const activeFilterCount =
    (search ? 1 : 0) + (filters.routeId !== 'all' ? 1 : 0) + (filters.status !== 'all' ? 1 : 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstShown = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastShown = (currentPage - 1) * PAGE_SIZE + pageRows.length;

  const updateFilter = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  // Look the conductor up on each render so the modal sees live changes.
  const editing = modal?.mode === 'edit' ? conductors.find((c) => c.id === modal.conductorId) : null;

  const addButton = (
    <button
      onClick={() => setModal({ mode: 'add' })}
      disabled={!busLine}
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <Plus className="w-4 h-4" />
      Add New Conductor
    </button>
  );

  return (
    <MainLayout
      pageTitle="Conductor Management"
      pageSubtitle="Monitor and manage conductor assignments."
      headerAction={addButton}
    >
      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Conductors</p>
            <h2 className="text-5xl font-black text-slate-950 tracking-tighter">{loading ? '–' : conductors.length}</h2>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Currently Active</p>
            <h2 className="text-5xl font-black text-slate-950 tracking-tighter">{loading ? '–' : activeCount}</h2>
          </div>
        </div>
      </div>

      {/* TABLE CARD */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        {/* Controls */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 bg-slate-50/60">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 text-[11px] font-semibold px-4 py-2 rounded-lg border transition-colors cursor-pointer ${
              showFilters || activeFilterCount > 0
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <p className="text-xs text-slate-500 font-medium">
            Showing {firstShown}-{lastShown} of {filtered.length} Conductor{filtered.length === 1 ? '' : 's'}
          </p>
        </div>

        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={filters.name}
                onChange={(event) => updateFilter({ name: event.target.value })}
                placeholder="Search by name or email"
                className="h-9 w-64 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <select
              value={filters.routeId}
              onChange={(event) => updateFilter({ routeId: event.target.value })}
              aria-label="Filter by route"
              className={selectClass}
            >
              <option value="all">All routes</option>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.startDestination && route.endDestination
                    ? `${route.startDestination} to ${route.endDestination}`
                    : route.name}
                </option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(event) => updateFilter({ status: event.target.value })}
              aria-label="Filter by status"
              className={selectClass}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {activeFilterCount > 0 && (
              <button
                onClick={() => updateFilter(EMPTY_FILTERS)}
                className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left table-auto">
            <thead className="border-y border-slate-100">
              <tr className="text-[11px] text-slate-500 uppercase font-semibold tracking-wider">
                <th className="px-5 py-4 min-w-[280px] pl-20">Conductor</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Assigned Bus</th>
                <th className="px-5 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((conductor) => {
                const assignment = activeByConductor.get(conductor.id);
                return (
                  <tr key={conductor.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4 pl-10">
                        <div className="w-10 h-10 shrink-0 rounded-full bg-slate-100 text-slate-500 ring-1 ring-slate-100 flex items-center justify-center">
                          <UserRound className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-950 truncate">{conductor.name || 'Unnamed'}</p>
                          <p className="text-xs text-slate-400 truncate">{conductor.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge active={Boolean(assignment)} />
                    </td>
                    <td className="px-5 py-4">
                      {assignment ? (
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 shrink-0 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                            <BusFront className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900">Bus {assignment.busId}</p>
                            {assignment.routeName && (
                              <p className="text-[11px] text-slate-400 truncate">{assignment.routeName}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-slate-400">N/A</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => setModal({ mode: 'edit', conductorId: conductor.id })}
                        aria-label={`Edit ${conductor.name || conductor.email}`}
                        className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <FilePenLine className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-14 text-center">
                    {loading ? (
                      <p className="text-sm text-slate-500">Loading conductors…</p>
                    ) : error ? (
                      <>
                        <p className="text-sm font-semibold text-red-600">Couldn’t load conductors</p>
                        <p className="text-xs text-slate-500 mt-1">Check your connection and refresh the page.</p>
                      </>
                    ) : conductors.length === 0 ? (
                      <>
                        <div className="w-12 h-12 mx-auto mb-3 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                          <Users className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-semibold text-slate-900">No conductors yet</p>
                        <p className="text-xs text-slate-500 mt-1">Click “Add New Conductor” to create the first account.</p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">No conductors match these filters.</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50/60">
          <button
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="text-xs font-semibold text-slate-700 px-4 py-2 bg-white hover:bg-slate-100 rounded-xl border border-slate-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <div className="flex items-center gap-1.5">
            {pageItems(currentPage, totalPages).map((item) =>
              typeof item === 'number' ? (
                <button
                  key={item}
                  onClick={() => setPage(item)}
                  className={`text-xs font-semibold w-8 h-8 rounded-lg cursor-pointer ${
                    item === currentPage ? 'bg-blue-600 text-white shadow shadow-blue-500/30' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item}
                </button>
              ) : (
                <span key={item} className="w-8 text-center text-xs text-slate-500">
                  …
                </span>
              ),
            )}
          </div>
          <button
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="text-xs font-semibold text-slate-700 px-4 py-2 bg-white hover:bg-slate-100 rounded-xl border border-slate-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      {modal?.mode === 'add' && <ConductorFormModal mode="add" onClose={() => setModal(null)} />}
      {modal?.mode === 'edit' && editing && (
        <ConductorFormModal
          mode="edit"
          conductor={editing}
          activeAssignment={activeByConductor.get(editing.id) ?? null}
          onClose={() => setModal(null)}
        />
      )}
    </MainLayout>
  );
}
