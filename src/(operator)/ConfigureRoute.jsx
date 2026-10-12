import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, AlertTriangle, ArrowLeft, ArrowLeftRight, Clock, Loader2, Map as MapIcon, Plus } from 'lucide-react';
import MainLayout from '../components/MainLayout';
import ConfirmDialog from '../components/ConfirmDialog';
import RouteStopList from '../components/RouteStopList';
import RouteEditorMap from '../components/RouteEditorMap';
import { useAuth } from '../context/AuthContext';
import useGoogleMaps from '../hooks/useGoogleMaps';
import useDrivingRoute from '../hooks/useDrivingRoute';
import useRoutes from '../hooks/useRoutes';
import { reverseGeocode } from '../utils/directions';
import { bestInsertIndex, DEFAULT_HOURS, formatDistance, formatHours, haversineMeters, parseHours } from '../utils/geo';
import { createRoute, getRoute, updateRoute } from '../utils/routeServices';

// The Directions API accepts at most 25 intermediate waypoints per request.
const MAX_WAYPOINTS = 25;
// Two routes count as "similar" when both ends are within this distance.
const SIMILAR_ROUTE_RADIUS_M = 300;
// Warn when a return route is this much longer than its source route.
const RETURN_DETOUR_RATIO = 1.15;

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `wp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// A point is { lat, lng, name, autoName }. `autoName` means the name was
// filled in by reverse geocoding (or is empty), so moving the point may
// replace it; a name the operator typed is never overwritten.
const emptyPoint = () => ({ lat: null, lng: null, name: '', autoName: true });
const isPlaced = (point) => point?.lat != null && point?.lng != null;

const pointFromDoc = (coords, name) => ({
  lat: coords?.lat ?? null,
  lng: coords?.lng ?? null,
  name: name ?? '',
  autoName: !name,
});

const describeRoute = (doc) =>
  doc.startDestination && doc.endDestination ? `${doc.startDestination} to ${doc.endDestination}` : doc.name || 'this route';

// "Alfonso, Cavite - PITX, Paranaque" → "PITX, Paranaque - Alfonso, Cavite".
// Returns null when the name isn't in that two-part form.
const reverseRouteName = (name) => {
  const parts = typeof name === 'string' ? name.split(' - ') : [];
  return parts.length === 2 ? `${parts[1].trim()} - ${parts[0].trim()}` : null;
};

/**
 * "Configure Active Route": create a route (/manage-route/new) or edit one
 * (/manage-route/:routeId/edit). Not in the sidebar — opened from Manage Route.
 */
export default function ConfigureRoute() {
  const { routeId } = useParams();
  const [searchParams] = useSearchParams();
  const returnOf = routeId ? null : searchParams.get('returnOf');
  // Re-mount when switching between routes so no state leaks across them.
  return <RouteEditor key={routeId ?? `new:${returnOf ?? ''}`} routeId={routeId} returnOf={returnOf} />;
}

/**
 * - edit:   routeId set → load that route and update it on save.
 * - return: returnOf set → load that route reversed (B→A) and save as a new route.
 * - new:    neither → empty form.
 */
function RouteEditor({ routeId, returnOf }) {
  const isEdit = Boolean(routeId);
  const isReturn = !isEdit && Boolean(returnOf);
  const sourceId = routeId || returnOf;
  const navigate = useNavigate();
  const { busLine } = useAuth();
  const { isLoaded: mapsLoaded, loadError: mapsError } = useGoogleMaps();

  const [loadState, setLoadState] = useState(sourceId ? 'loading' : 'ready'); // loading | ready | notFound | error
  const [start, setStart] = useState(emptyPoint);
  const [end, setEnd] = useState(emptyPoint);
  const [waypoints, setWaypoints] = useState([]);
  const [hours, setHours] = useState(DEFAULT_HOURS);
  const [original, setOriginal] = useState(null); // { name, startDestination, endDestination } when editing
  const [returnSource, setReturnSource] = useState(null); // { title, distanceMeters } when creating a return route

  const [pickTarget, setPickTarget] = useState(null); // 'start' | 'end' | waypoint id | 'new' | null
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // ---- point updates --------------------------------------------------------

  const updatePoint = useCallback((target, updater) => {
    if (target === 'start') setStart(updater);
    else if (target === 'end') setEnd(updater);
    else setWaypoints((prev) => prev.map((w) => (w.id === target ? updater(w) : w)));
  }, []);

  // Fill in a place name for a point, but only if it still sits at the same
  // spot and the operator hasn't typed their own name in the meantime.
  const autoNamePoint = useCallback(
    async (target, lat, lng) => {
      const name = await reverseGeocode({ lat, lng });
      if (!name) return;
      updatePoint(target, (p) => (p.autoName && p.lat === lat && p.lng === lng ? { ...p, name } : p));
    },
    [updatePoint],
  );

  const movePoint = (target, lat, lng) => {
    updatePoint(target, (p) => ({ ...p, lat, lng }));
    setDirty(true);
    autoNamePoint(target, lat, lng);
  };

  // ---- load existing route --------------------------------------------------

  useEffect(() => {
    if (!sourceId) return undefined;
    let cancelled = false;
    getRoute(sourceId)
      .then((doc) => {
        if (cancelled) return;
        // Operators may only edit (or reverse) routes on their own bus line.
        if (!doc || doc.line !== busLine) {
          setLoadState('notFound');
          return;
        }
        const waypointsFromDoc = (doc.waypoints ?? []).map((w) => ({ id: makeId(), ...pointFromDoc(w, w.name) }));
        setHours(parseHours(doc.hours));

        if (isReturn) {
          // Same stops, opposite direction. Waypoint names are carried over
          // as-is (still editable) and marked as typed, so moving a pin
          // won't replace them with a geocoded name.
          setStart(pointFromDoc(doc.EndingPoint, doc.endDestination));
          setEnd(pointFromDoc(doc.StartingPoint, doc.startDestination));
          setWaypoints(waypointsFromDoc.reverse());
          setOriginal({
            name: reverseRouteName(doc.name),
            startDestination: doc.endDestination,
            endDestination: doc.startDestination,
          });
          setReturnSource({ title: describeRoute(doc), distanceMeters: doc.distanceMeters });
          setDirty(true); // nothing is saved until the operator saves
        } else {
          setStart(pointFromDoc(doc.StartingPoint, doc.startDestination));
          setEnd(pointFromDoc(doc.EndingPoint, doc.endDestination));
          setWaypoints(waypointsFromDoc);
          setOriginal({ name: doc.name, startDestination: doc.startDestination, endDestination: doc.endDestination });
        }
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId, isReturn, busLine]);

  // Older routes saved waypoints without names — look them up once the map
  // API is ready. This doesn't mark the form dirty.
  const namedOnLoadRef = useRef(false);
  useEffect(() => {
    if (!mapsLoaded || loadState !== 'ready' || namedOnLoadRef.current) return;
    namedOnLoadRef.current = true;
    [['start', start], ['end', end], ...waypoints.map((w) => [w.id, w])].forEach(([target, p]) => {
      if (isPlaced(p) && !p.name) autoNamePoint(target, p.lat, p.lng);
    });
  }, [mapsLoaded, loadState, start, end, waypoints, autoNamePoint]);

  // ---- route calculation ----------------------------------------------------

  const {
    route,
    loading: routeLoading,
    error: routeError,
  } = useDrivingRoute(
    isPlaced(start) ? start : null,
    isPlaced(end) ? end : null,
    waypoints,
    mapsLoaded && loadState === 'ready',
  );

  // ---- pick mode ------------------------------------------------------------

  useEffect(() => {
    if (!pickTarget) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setPickTarget(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pickTarget]);

  const handleMapPick = (lat, lng) => {
    const target = pickTarget;
    setPickTarget(null);
    if (target !== 'new') {
      movePoint(target, lat, lng);
      return;
    }
    const waypoint = { id: makeId(), lat, lng, name: '', autoName: true };
    setWaypoints((prev) => {
      // Slot the new stop where it adds the least detour (needs both ends placed).
      const index =
        isPlaced(start) && isPlaced(end) ? bestInsertIndex([start, ...prev, end], { lat, lng }) : prev.length;
      return [...prev.slice(0, index), waypoint, ...prev.slice(index)];
    });
    setDirty(true);
    autoNamePoint(waypoint.id, lat, lng);
  };

  const pickLabel = (() => {
    if (!pickTarget) return null;
    if (pickTarget === 'new') return 'a new stop';
    if (pickTarget === 'start') return 'the starting destination';
    if (pickTarget === 'end') return 'the ending destination';
    const index = waypoints.findIndex((w) => w.id === pickTarget);
    return index >= 0 ? `stop ${index + 1}` : null;
  })();

  // ---- stop list handlers ---------------------------------------------------

  const handleNameChange = (target, name) => {
    updatePoint(target, (p) => ({ ...p, name, autoName: name.trim() === '' }));
    setDirty(true);
  };

  const handleRemove = (id) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
    if (pickTarget === id) setPickTarget(null);
    setDirty(true);
  };

  const handleReorder = (next) => {
    setWaypoints(next);
    setDirty(true);
  };

  const updateHours = (patch) => {
    setHours((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  // ---- leaving / saving -----------------------------------------------------

  useEffect(() => {
    if (!dirty || saving) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, saving]);

  const goBack = () => navigate('/manage-route');
  const handleBack = () => (dirty ? setConfirmLeave(true) : goBack());

  const startName = start.name.trim();
  const endName = end.name.trim();
  const routeReady = Boolean(route) && !routeLoading && !routeError;

  const problems = [];
  if (!isPlaced(start)) problems.push('Place the starting destination on the map.');
  else if (!startName) problems.push('Name the starting destination.');
  if (!isPlaced(end)) problems.push('Place the ending destination on the map.');
  else if (!endName) problems.push('Name the ending destination.');
  if (!hours.allDay && (!hours.start || !hours.end)) problems.push('Set both operating hours.');
  if (!busLine) problems.push('Your account has no bus line assigned.');

  const canSave = problems.length === 0 && routeReady && !saving;

  // ---- warnings (don't block saving) ----------------------------------------

  const { routes: lineRoutes } = useRoutes(busLine);
  const similarRoute =
    isPlaced(start) && isPlaced(end)
      ? lineRoutes.find(
          (r) =>
            r.id !== routeId &&
            isPlaced(r.StartingPoint) &&
            isPlaced(r.EndingPoint) &&
            haversineMeters(r.StartingPoint, start) <= SIMILAR_ROUTE_RADIUS_M &&
            haversineMeters(r.EndingPoint, end) <= SIMILAR_ROUTE_RADIUS_M,
        )
      : null;

  const returnDetour =
    isReturn && routeReady && typeof returnSource?.distanceMeters === 'number'
      ? route.distanceMeters > returnSource.distanceMeters * RETURN_DETOUR_RATIO
      : false;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);

    // Keep the existing display name unless the endpoints were renamed.
    const keepName =
      original?.name && original.startDestination === startName && original.endDestination === endName;

    const data = {
      name: keepName ? original.name : `${startName} - ${endName}`,
      startDestination: startName,
      endDestination: endName,
      StartingPoint: { lat: start.lat, lng: start.lng },
      EndingPoint: { lat: end.lat, lng: end.lng },
      waypoints: waypoints.map((w, i) => ({ lat: w.lat, lng: w.lng, name: w.name.trim() || `Stop ${i + 1}` })),
      // {latitude, longitude} to match the mobile apps' polyline shape.
      routeCoordinates: route.coordinates.map(({ lat, lng }) => ({ latitude: lat, longitude: lng })),
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      hours: formatHours(hours),
      line: busLine,
    };

    try {
      if (isEdit) await updateRoute(routeId, data);
      else await createRoute(data);
      setDirty(false);
      goBack();
    } catch {
      setSaveError('Couldn’t save the route. Check your connection and try again.');
      setSaving(false);
    }
  };

  // ---- render ---------------------------------------------------------------

  const backButton = (
    <button
      type="button"
      onClick={handleBack}
      className="flex items-center gap-2 text-xs font-semibold text-slate-700 px-4 py-2.5 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Routes
    </button>
  );

  const layoutProps = {
    pageTitle: 'Configure Active Route',
    pageSubtitle: 'Define pathing and operational parameters for fleet assignment.',
    headerAction: backButton,
  };

  if (loadState !== 'ready') {
    const message = {
      loading: { title: 'Loading route…', body: null },
      notFound: { title: 'Route not found', body: 'It may have been deleted, or it belongs to another bus line.' },
      error: { title: 'Couldn’t load this route', body: 'Check your connection and refresh the page.' },
    }[loadState];
    return (
      <MainLayout {...layoutProps}>
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-10 text-center max-w-xl">
          {loadState === 'loading' && <Loader2 className="w-6 h-6 mx-auto mb-3 animate-spin text-blue-600" />}
          <p className="text-sm font-semibold text-slate-900">{message.title}</p>
          {message.body && <p className="text-xs text-slate-500 mt-1">{message.body}</p>}
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout {...layoutProps}>
      <div className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-6 flex-1 min-h-[640px]">
        {/* ROUTE PARAMETERS CARD */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col min-h-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-950">Route Parameters</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {(isReturn || similarRoute || returnDetour) && (
              <div className="flex flex-col gap-2 mb-5">
                {isReturn && returnSource && (
                  <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs text-blue-800">
                    <ArrowLeftRight className="w-4 h-4 shrink-0 mt-px" />
                    <p>
                      Return route of <span className="font-semibold">{returnSource.title}</span>. Review the path,
                      then save.
                    </p>
                  </div>
                )}
                {returnDetour && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                    <p>
                      This return route is {formatDistance(route.distanceMeters)} vs{' '}
                      {formatDistance(returnSource.distanceMeters)} the other way. A stop may be on the opposite side
                      of a divided road, forcing a U-turn. Drag it to the correct side.
                    </p>
                  </div>
                )}
                {similarRoute && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                    <p>
                      A similar route already exists:{' '}
                      <span className="font-semibold">{describeRoute(similarRoute)}</span>.
                    </p>
                  </div>
                )}
              </div>
            )}

            <RouteStopList
              start={start}
              end={end}
              waypoints={waypoints}
              pickTarget={pickTarget}
              onNameChange={handleNameChange}
              onPick={(target) => setPickTarget((current) => (current === target ? null : target))}
              onRemove={handleRemove}
              onReorder={handleReorder}
            />

            <div className="flex justify-end mt-5">
              <button
                type="button"
                onClick={() => setPickTarget((current) => (current === 'new' ? null : 'new'))}
                disabled={!mapsLoaded || waypoints.length >= MAX_WAYPOINTS}
                className={`flex items-center gap-1.5 text-xs font-bold px-5 py-2.5 rounded-full border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  pickTarget === 'new'
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-white border-slate-400 text-red-600 hover:bg-red-50'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                {pickTarget === 'new' ? 'Click the map…' : 'Add Stop/Pin'}
              </button>
            </div>
            {waypoints.length >= MAX_WAYPOINTS && (
              <p className="text-[11px] text-slate-500 text-right mt-1.5">Maximum of {MAX_WAYPOINTS} stops reached.</p>
            )}

            {/* OPERATING HOURS */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">Operating Hours</p>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hours.allDay}
                    onChange={(event) => updateHours({ allDay: event.target.checked })}
                    className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                  />
                  24 hours
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'start', label: 'Start Time' },
                  { key: 'end', label: 'End Time' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-700 pl-1">{label}</span>
                    <div
                      className={`flex items-center h-11 rounded-xl border border-slate-200/80 bg-[#eef1fb] overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 ${
                        hours.allDay ? 'opacity-50' : ''
                      }`}
                    >
                      <span className="h-full px-2.5 flex items-center bg-white border-r border-slate-200/80">
                        <Clock className="w-4 h-4 text-slate-500" />
                      </span>
                      <input
                        type="time"
                        value={hours[key]}
                        disabled={hours.allDay}
                        onChange={(event) => updateHours({ [key]: event.target.value })}
                        className="flex-1 min-w-0 h-full bg-transparent px-2.5 text-sm text-slate-900 outline-none disabled:cursor-not-allowed"
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="p-5 bg-slate-50/80 border-t border-slate-100">
            {(saveError || routeError) && (
              <div className="flex items-start gap-2 mb-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-xs font-medium text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                {saveError ||
                  'Couldn’t find a driving route through these points. Try moving a pin onto a road.'}
              </div>
            )}
            {!saveError && !routeError && problems.length > 0 && (
              <p className="mb-3 text-[11px] text-slate-500 text-center">{problems[0]}</p>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border border-slate-400 rounded-full py-3 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save Route Configuration'}
            </button>
          </div>
        </div>

        {/* MAP CARD */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden min-h-[480px]">
          {mapsError ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <AlertCircle className="w-8 h-8 mb-2 text-red-500" />
              <p className="text-sm font-semibold text-slate-900">Google Maps failed to load</p>
              <p className="text-xs mt-1">Check the Maps API key in .env.</p>
            </div>
          ) : mapsLoaded ? (
            <RouteEditorMap
              start={start}
              end={end}
              waypoints={waypoints}
              route={route}
              routeLoading={routeLoading}
              pickLabel={pickLabel}
              onMapPick={handleMapPick}
              onMarkerMove={movePoint}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400">
              <MapIcon className="w-10 h-10 animate-pulse mb-2 text-blue-500" />
              <p className="text-sm font-semibold">Loading map…</p>
            </div>
          )}
        </div>
      </div>

      {confirmLeave && (
        <ConfirmDialog
          title="Discard changes?"
          message="You have unsaved changes to this route. Leaving now will discard them."
          confirmLabel="Discard"
          onConfirm={goBack}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </MainLayout>
  );
}
