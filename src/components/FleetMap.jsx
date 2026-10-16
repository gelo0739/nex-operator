import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, PolylineF } from '@react-google-maps/api';
import {
  Bus,
  CalendarClock,
  Clock,
  Gauge,
  Loader2,
  Maximize2,
  Route as RouteIcon,
  TriangleAlert,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import useGoogleMaps, { MAP_ID } from '../hooks/useGoogleMaps';
import AdvancedMarker from './AdvancedMarker';
import MapPin from './MapPin';
import FloatingOverlay from './FloatingOverlay';
import LiveElapsed from './LiveElapsed';
import { getRoute } from '../utils/routeServices';
import { formatDateTime, formatDuration } from '../utils/format';

const CONTAINER_STYLE = { width: '100%', height: '100%', borderRadius: '1.25rem' };
const DEFAULT_CENTER = { lat: 14.28, lng: 120.93 }; // Cavite
const DEFAULT_ZOOM = 11;
const FOCUS_ZOOM = 16;
const MAP_OPTIONS = {
  mapId: MAP_ID,
  streetViewControl: false,
  fullscreenControl: false,
  mapTypeControl: false,
  clickableIcons: false,
};

// Focused bus's route: the part already covered is solid; the part ahead is dashed.
const COVERED_LINE = { strokeColor: '#1d4ed8', strokeOpacity: 0.95, strokeWeight: 6, clickable: false, zIndex: 2 };
const AHEAD_LINE = {
  strokeOpacity: 0,
  clickable: false,
  zIndex: 1,
  icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, strokeColor: '#3b82f6', scale: 4 }, offset: '0', repeat: '16px' }],
};

// Pop-up sits this many px above the bus position (clears the lifted pin).
const POPUP_OFFSET_Y = 58;

const formatUpdatedAgo = (seconds) => (seconds < 5 ? 'just now' : `${Math.round(seconds)}s ago`);

function fitToBuses(map, buses) {
  if (!map || buses.length === 0) return;
  if (buses.length === 1) {
    map.panTo({ lat: buses[0].lat, lng: buses[0].lng });
    map.setZoom(14);
    return;
  }
  const bounds = new window.google.maps.LatLngBounds();
  buses.forEach((b) => bounds.extend({ lat: b.lat, lng: b.lng }));
  map.fitBounds(bounds, 80);
}

// Index of the route point nearest the bus (planar distance is fine at city scale).
function nearestIndex(path, point) {
  let best = 0;
  let bestDist = Infinity;
  path.forEach((p, i) => {
    const d = (p.lat - point.lat) ** 2 + (p.lng - point.lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-xs font-semibold text-slate-900">{children}</span>
    </div>
  );
}

const NO_BUSES = [];

/**
 * Live fleet map: one pin per live bus. Click a bus to focus it — the pin
 * lifts, the map zooms in and follows it, its route is drawn (covered vs
 * ahead) and a pop-up shows speed, conductor and time on the trip. Unfocus
 * (same pin, ✕, empty map, or Esc) zooms back out to where you were.
 *
 * `inoperableBuses` (marked inoperable by a conductor) get a red pin; clicking
 * one opens a pop-up with a "Return to service" button (`onReturnToService`).
 */
export default function FleetMap({ buses, conductorNames, inoperableBuses = NO_BUSES, onReturnToService }) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [map, setMap] = useState(null);
  const [focusedId, setFocusedId] = useState(null);
  const [selectedInoperableId, setSelectedInoperableId] = useState(null);
  const [routeCache, setRouteCache] = useState({}); // routeId -> [{lat,lng}] | null
  const prevViewRef = useRef(null); // view to restore when unfocusing
  const hasFittedRef = useRef(false);

  const focusedBus = focusedId ? buses.find((b) => b.busId === focusedId) ?? null : null;

  // Inoperable buses with a known position (the rest only show in lists).
  const mappedInoperable = useMemo(
    () => inoperableBuses.filter((b) => Number.isFinite(b.lat) && Number.isFinite(b.lng)),
    [inoperableBuses],
  );
  const selectedInoperable = selectedInoperableId
    ? mappedInoperable.find((b) => b.busId === selectedInoperableId) ?? null
    : null;
  const allPins = useMemo(() => [...buses, ...mappedInoperable], [buses, mappedInoperable]);

  // Frame all buses once, the first time any are on the map.
  useEffect(() => {
    if (!map || hasFittedRef.current || allPins.length === 0) return;
    fitToBuses(map, allPins);
    hasFittedRef.current = true;
  }, [map, allPins]);

  // Follow the focused bus as it moves.
  const focusLat = focusedBus?.lat;
  const focusLng = focusedBus?.lng;
  useEffect(() => {
    if (map && focusLat != null && focusLng != null) map.panTo({ lat: focusLat, lng: focusLng });
  }, [map, focusLat, focusLng]);

  // Unfocused (by any means, incl. the bus going offline): zoom back out.
  useEffect(() => {
    if (focusedBus || !map || !prevViewRef.current) return;
    const { center, zoom } = prevViewRef.current;
    prevViewRef.current = null;
    map.panTo(center);
    map.setZoom(zoom);
  }, [focusedBus, map]);

  // Esc unfocuses (and closes an inoperable bus's pop-up).
  const hasPopup = Boolean(focusedBus || selectedInoperable);
  useEffect(() => {
    if (!hasPopup) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setFocusedId(null);
      setSelectedInoperableId(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [hasPopup]);

  // Load (once) the planned route of the focused bus.
  const focusRouteId = focusedBus?.routeId ?? null;
  useEffect(() => {
    if (!focusRouteId || focusRouteId in routeCache) return undefined;
    let cancelled = false;
    getRoute(focusRouteId)
      .then((route) => {
        const path = (route?.routeCoordinates ?? [])
          .filter((c) => Number.isFinite(c?.latitude) && Number.isFinite(c?.longitude))
          .map((c) => ({ lat: c.latitude, lng: c.longitude }));
        if (!cancelled) setRouteCache((prev) => ({ ...prev, [focusRouteId]: path.length > 1 ? path : null }));
      })
      .catch(() => !cancelled && setRouteCache((prev) => ({ ...prev, [focusRouteId]: null })));
    return () => {
      cancelled = true;
    };
  }, [focusRouteId, routeCache]);

  const routePath = focusRouteId ? routeCache[focusRouteId] : null;
  const routeLoading = Boolean(focusRouteId) && !(focusRouteId in routeCache);

  // Split the route where the bus is.
  const routeSplit = useMemo(() => {
    if (!routePath || focusLat == null || focusLng == null) return null;
    const here = { lat: focusLat, lng: focusLng };
    const i = nearestIndex(routePath, here);
    return { covered: [...routePath.slice(0, i + 1), here], ahead: [here, ...routePath.slice(i + 1)] };
  }, [routePath, focusLat, focusLng]);

  // Inoperable pins don't move: no focus/follow, just pan to it and toggle
  // its pop-up.
  const handleInoperableClick = (bus) => {
    if (!map) return;
    if (selectedInoperableId === bus.busId) {
      setSelectedInoperableId(null);
      return;
    }
    prevViewRef.current = null; // leaving a focused live bus: don't zoom back out
    setFocusedId(null);
    setSelectedInoperableId(bus.busId);
    map.panTo({ lat: bus.lat, lng: bus.lng });
  };

  const handleBusClick = (bus) => {
    if (!map) return;
    setSelectedInoperableId(null);
    if (focusedId === bus.busId) {
      setFocusedId(null);
      return;
    }
    // Remember the overview to return to (only when entering focus mode).
    if (!prevViewRef.current) {
      prevViewRef.current = { center: map.getCenter().toJSON(), zoom: map.getZoom() };
    }
    setFocusedId(bus.busId);
    map.panTo({ lat: bus.lat, lng: bus.lng });
    map.setZoom(FOCUS_ZOOM);
  };

  // A click inside the pop-up also reaches the map's click handler (which
  // unfocuses). Mark presses that start in the pop-up so the map ignores them.
  // (Stopping propagation instead would also block React's own onClick
  // handlers, e.g. the ✕ button, since React listens at the app root.)
  // The mark expires after 1.5 s, so a pop-up click the map never sees can't
  // swallow a later, real map click.
  const popupPressAtRef = useRef(0);
  const handleMapClick = (event) => {
    const pressedInPopup = event?.domEvent && event.domEvent.timeStamp - popupPressAtRef.current < 1500;
    popupPressAtRef.current = 0;
    if (pressedInPopup) return;
    if (focusedId) setFocusedId(null);
    if (selectedInoperableId) setSelectedInoperableId(null);
  };

  if (loadError) {
    return <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">Google Maps failed to load.</div>;
  }
  if (!isLoaded) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-400 rounded-2xl">
        <Bus className="w-10 h-10 animate-bounce mb-2 text-blue-500" />
        <p className="text-sm font-semibold">Loading Cavite Map...</p>
      </div>
    );
  }

  const conductorName = focusedBus ? conductorNames.get(focusedBus.conductorId) : null;
  // One FloatingOverlay per map: it shows either the focused live bus or the
  // selected inoperable bus (never both).
  const popupBus = focusedBus ?? selectedInoperable;
  const markPopupPress = (event) => {
    popupPressAtRef.current = event.timeStamp;
  };

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={CONTAINER_STYLE}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        options={MAP_OPTIONS}
        onLoad={setMap}
        onUnmount={() => setMap(null)}
        onClick={handleMapClick}
      >
        {focusedBus && routeSplit && (
          <>
            <PolylineF path={routeSplit.ahead} options={AHEAD_LINE} />
            <PolylineF path={routeSplit.covered} options={COVERED_LINE} />
          </>
        )}

        {buses.map((bus) => {
          const active = bus.busId === focusedBus?.busId;
          return (
            <AdvancedMarker
              key={bus.busId}
              position={{ lat: bus.lat, lng: bus.lng }}
              title={active ? `${bus.busId} — click to unfocus` : `${bus.busId} — click to focus`}
              zIndex={active ? 100 : 10}
              onClick={() => handleBusClick(bus)}
            >
              <MapPin variant="bus" label={bus.busId} active={active} dimmed={Boolean(popupBus) && !active} />
            </AdvancedMarker>
          );
        })}

        {mappedInoperable.map((bus) => {
          const active = bus.busId === selectedInoperable?.busId;
          return (
            <AdvancedMarker
              key={`inoperable-${bus.busId}`}
              position={{ lat: bus.lat, lng: bus.lng }}
              title={`${bus.busId} — inoperable`}
              zIndex={active ? 100 : 50}
              onClick={() => handleInoperableClick(bus)}
            >
              <MapPin variant="inoperable" label={bus.busId} active={active} dimmed={Boolean(popupBus) && !active} />
            </AdvancedMarker>
          );
        })}

        {popupBus && (
          <FloatingOverlay position={{ lat: popupBus.lat, lng: popupBus.lng }} offsetY={POPUP_OFFSET_Y}>
            {focusedBus ? (
              <div
                onPointerDown={markPopupPress}
                className="w-64 bg-white rounded-2xl shadow-xl shadow-slate-900/20 border border-slate-200/70 overflow-hidden transition duration-200 ease-out starting:opacity-0 starting:translate-y-1 motion-reduce:transition-none"
              >
                <div className="flex items-start gap-2.5 px-4 pt-3 pb-2.5 bg-blue-50/70 border-b border-blue-100">
                  <div className="w-8 h-8 shrink-0 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Bus className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-950">{focusedBus.busId}</p>
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse motion-reduce:animate-none" />
                      Live
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFocusedId(null)}
                    aria-label="Unfocus bus"
                    title="Unfocus (Esc)"
                    className="p-1 -mr-1 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-2 px-4 py-3">
                  <InfoRow icon={Gauge} label="Speed">
                    {Number.isFinite(focusedBus.speed) ? `${focusedBus.speed.toFixed(0)} km/h` : '—'}
                  </InfoRow>
                  <InfoRow icon={UserRound} label="Conductor">
                    {conductorName || 'Unknown'}
                  </InfoRow>
                  <InfoRow icon={Clock} label="On trip">
                    <LiveElapsed since={focusedBus.tripStartedAt} format={formatDuration} />
                  </InfoRow>
                  <InfoRow icon={RouteIcon} label="Route">
                    <span title={focusedBus.routeName ?? ''}>{focusedBus.routeName || 'No route assigned'}</span>
                  </InfoRow>
                </div>
                <p className="px-4 pb-3 text-[10px] text-slate-400">
                  Updated <LiveElapsed since={focusedBus.lastUpdated} format={formatUpdatedAgo} />
                </p>
              </div>
            ) : (
              <div
                onPointerDown={markPopupPress}
                className="w-64 bg-white rounded-2xl shadow-xl shadow-slate-900/20 border border-slate-200/70 overflow-hidden transition duration-200 ease-out starting:opacity-0 starting:translate-y-1 motion-reduce:transition-none"
              >
                <div className="flex items-start gap-2.5 px-4 pt-3 pb-2.5 bg-red-50/80 border-b border-red-100">
                  <div className="w-8 h-8 shrink-0 rounded-xl bg-red-600 text-white flex items-center justify-center">
                    <TriangleAlert className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-950">{selectedInoperable.busId}</p>
                    <p className="text-[11px] font-semibold text-red-700">This bus is inoperable</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedInoperableId(null)}
                    aria-label="Close"
                    title="Close (Esc)"
                    className="p-1 -mr-1 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-2 px-4 py-3">
                  <InfoRow icon={UserRound} label="Reported by">
                    {selectedInoperable.conductorName || conductorNames.get(selectedInoperable.conductorId) || 'Unknown'}
                  </InfoRow>
                  <InfoRow icon={RouteIcon} label="Route">
                    <span title={selectedInoperable.routeName ?? ''}>{selectedInoperable.routeName || 'No route assigned'}</span>
                  </InfoRow>
                  <InfoRow icon={CalendarClock} label="Since">
                    {formatDateTime(selectedInoperable.inoperableAt)}
                  </InfoRow>
                </div>
                {onReturnToService && (
                  <div className="px-4 pb-3">
                    <button
                      type="button"
                      onClick={() => onReturnToService(selectedInoperable)}
                      className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-white px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-600/30 transition-colors cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      Return to service
                    </button>
                  </div>
                )}
              </div>
            )}
          </FloatingOverlay>
        )}
      </GoogleMap>

      {/* Fit all */}
      {allPins.length > 0 && !popupBus && (
        <button
          type="button"
          onClick={() => fitToBuses(map, allPins)}
          title="Show all buses"
          className="absolute top-3 right-3 flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 bg-white px-3 py-2 rounded-xl shadow cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Fit all buses
        </button>
      )}

      {/* Hint / empty state */}
      {allPins.length === 0 ? (
        <div className="absolute inset-x-0 top-4 flex justify-center pointer-events-none">
          <p className="bg-white/95 text-slate-600 text-xs font-semibold px-4 py-2 rounded-full shadow">
            No buses on your line are live right now
          </p>
        </div>
      ) : (
        !popupBus && (
          <div className="absolute left-3 bottom-3 pointer-events-none">
            <p className="bg-white/95 text-slate-500 text-[11px] font-medium px-3 py-1.5 rounded-full shadow">
              Click a bus to focus it
            </p>
          </div>
        )
      )}

      {focusedBus && routeLoading && (
        <div className="absolute left-3 bottom-3 flex items-center gap-2 bg-white/95 text-slate-600 text-[11px] font-medium px-3 py-1.5 rounded-full shadow">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          Loading route…
        </div>
      )}
    </div>
  );
}
