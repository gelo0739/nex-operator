import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Plus, Pencil, Trash2, Route as RouteIcon } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import useRoutes from '../hooks/useRoutes';
import { deleteRoute } from '../utils/routeServices';

const routeTitle = (route) =>
  route.startDestination && route.endDestination
    ? `${route.startDestination} to ${route.endDestination}`
    : route.name || 'Untitled route';
const formatDistance = (meters) => (typeof meters === 'number' ? `${(meters / 1000).toFixed(1)} km` : '—');

function RouteCard({ route, onEdit, onCreateReturn, onDelete }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 flex flex-col">
      <h3 className="text-base font-bold text-slate-950">{routeTitle(route)}</h3>

      <div className="mt-6 self-start bg-blue-50/60 rounded-xl px-3 py-2 min-w-[92px]">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Distance</p>
        <p className="text-lg font-bold text-blue-600 leading-tight">{formatDistance(route.distanceMeters)}</p>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <button
          onClick={onEdit}
          aria-label={`Edit ${routeTitle(route)}`}
          className="p-2 -ml-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onCreateReturn}
          title={`Create the return route (${route.endDestination ?? 'end'} to ${route.startDestination ?? 'start'})`}
          className="flex items-center gap-1 text-xs font-semibold text-blue-600 px-2 py-1.5 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
          Return
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-xs font-semibold text-red-600 px-2 py-1.5 -mr-2 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}

export default function ManageRoute() {
  const { busLine } = useAuth();
  const navigate = useNavigate();
  // Operators only see (and manage) the routes on their own bus line.
  const { routes: visibleRoutes, loading, error } = useRoutes(busLine);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteRoute(deleting.id); // the live subscription removes the card
      setDeleting(null);
    } catch {
      setDeleteError(`Couldn’t delete ${routeTitle(deleting)}. Please try again.`);
      setDeleting(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const addRouteButton = (
    <button
      onClick={() => navigate('/manage-route/new')}
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer">
      <Plus className="w-4 h-4" />
      Add New Route
    </button>
  );

  return (
    <MainLayout
      pageTitle="Route Management"
      pageSubtitle="Edit, and organize all active transit routes across the network."
      headerAction={addRouteButton}
    >
      {!busLine ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8 text-center">
          <p className="text-sm font-semibold text-slate-900">No bus line assigned</p>
          <p className="text-xs text-slate-500 mt-1">This account has no bus line set on its profile. Contact an administrator.</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8 text-center max-w-3xl">
          <p className="text-sm text-slate-500">Loading routes…</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center max-w-3xl">
          <p className="text-sm font-semibold text-red-600">Couldn’t load routes</p>
          <p className="text-xs text-slate-500 mt-1">Check your connection and refresh the page.</p>
        </div>
      ) : (
        <>
          {deleteError && (
            <div className="max-w-3xl rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-xs font-medium text-red-700">
              {deleteError}
            </div>
          )}

          {visibleRoutes.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 max-w-3xl">
              {visibleRoutes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  onEdit={() => navigate(`/manage-route/${route.id}/edit`)}
                  onCreateReturn={() => navigate(`/manage-route/new?returnOf=${route.id}`)}
                  onDelete={() => setDeleting(route)}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-10 text-center max-w-3xl">
              <div className="w-12 h-12 mx-auto mb-3 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                <RouteIcon className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-900">No routes yet</p>
              <p className="text-xs text-slate-500 mt-1">Click “Add New Route” to create the first route on the {busLine} line.</p>
            </div>
          )}

          <div className="border-t border-slate-200 max-w-[216px]" />

          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 w-40">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Routes</p>
            <p className="text-4xl font-black text-slate-950 tracking-tighter mt-1">{visibleRoutes.length}</p>
          </div>
        </>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${routeTitle(deleting)}?`}
          message="This removes the route from your network. This action cannot be undone."
          confirmLabel={isDeleting ? 'Deleting…' : 'Delete Route'}
          onConfirm={isDeleting ? () => {} : handleDelete}
          onCancel={() => !isDeleting && setDeleting(null)}
        />
      )}
    </MainLayout>
  );
}
