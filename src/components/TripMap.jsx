import { useEffect, useMemo, useState } from 'react';
import { GoogleMap, PolylineF } from '@react-google-maps/api';
import { Loader2, MapPinOff } from 'lucide-react';
import useGoogleMaps, { MAP_ID } from '../hooks/useGoogleMaps';
import AdvancedMarker from './AdvancedMarker';
import MapPin from './MapPin';
import { getRoute } from '../utils/routeServices';

const CONTAINER_STYLE = { width: '100%', height: '100%' };
const MAP_OPTIONS = {
  mapId: MAP_ID,
  streetViewControl: false,
  fullscreenControl: true,
  mapTypeControl: false,
  clickableIcons: false,
};
// Planned route: soft line under the pins.
const ROUTE_LINE = { strokeColor: '#5b3bff', strokeOpacity: 0.45, strokeWeight: 5, clickable: false, zIndex: 1 };
// No planned route on file: dashed straight line from start to end.
const DIRECT_LINE = {
  strokeOpacity: 0,
  clickable: false,
  zIndex: 1,
  icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, strokeColor: '#475569', scale: 3 }, offset: '0', repeat: '14px' }],
};

const isCoord = (lat, lng) =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng);

/**
 * Where a completed trip started and ended (from the conductor's GPS), drawn
 * over the route it was assigned to when that route still exists.
 */
export default function TripMap({ trip }) {
  const { isLoaded, loadError } = useGoogleMaps();
  const [map, setMap] = useState(null);
  const [routeState, setRouteState] = useState({ routeId: null, path: null });

  const start = isCoord(trip.startLatitude, trip.startLongitude) ? { lat: trip.startLatitude, lng: trip.startLongitude } : null;
  const end = isCoord(trip.endLatitude, trip.endLongitude) ? { lat: trip.endLatitude, lng: trip.endLongitude } : null;

  // The assigned route's planned polyline (routeCoordinates are {latitude, longitude}).
  useEffect(() => {
    if (!trip.routeId) return undefined;
    let cancelled = false;
    getRoute(trip.routeId)
      .then((route) => {
        if (cancelled) return;
        const path = (route?.routeCoordinates ?? [])
          .filter((c) => isCoord(c?.latitude, c?.longitude))
          .map((c) => ({ lat: c.latitude, lng: c.longitude }));
        setRouteState({ routeId: trip.routeId, path: path.length > 1 ? path : null });
      })
      .catch(() => !cancelled && setRouteState({ routeId: trip.routeId, path: null }));
    return () => {
      cancelled = true;
    };
  }, [trip.routeId]);

  const routePath = routeState.routeId === trip.routeId ? routeState.path : null;
  const routeLoading = Boolean(trip.routeId) && routeState.routeId !== trip.routeId;

  const framePoints = useMemo(
    () => [start, end, ...(routePath ?? [])].filter(Boolean),
    // start/end are rebuilt each render from primitive fields; key on those.
    [trip.startLatitude, trip.startLongitude, trip.endLatitude, trip.endLongitude, routePath], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Frame the trip once the map, the pins and (if any) the route are ready.
  useEffect(() => {
    if (!map || routeLoading || framePoints.length === 0) return;
    if (framePoints.length === 1 || (start && end && start.lat === end.lat && start.lng === end.lng && !routePath)) {
      map.panTo(framePoints[0]);
      map.setZoom(16);
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    framePoints.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 40);
  }, [map, framePoints, routeLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!start && !end) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center text-slate-400 bg-slate-50">
        <MapPinOff className="w-7 h-7" />
        <p className="text-xs">No GPS location was recorded for this trip.</p>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-slate-500 bg-slate-50">Google Maps failed to load.</div>
    );
  }
  if (!isLoaded) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <GoogleMap
        mapContainerStyle={CONTAINER_STYLE}
        center={start ?? end}
        zoom={13}
        options={MAP_OPTIONS}
        onLoad={setMap}
        onUnmount={() => setMap(null)}
      >
        {routePath && <PolylineF path={routePath} options={ROUTE_LINE} />}
        {!routePath && !routeLoading && start && end && <PolylineF path={[start, end]} options={DIRECT_LINE} />}
        {start && (
          <AdvancedMarker position={start} title="Trip started here" anchor="center" zIndex={30}>
            <MapPin variant="start" />
          </AdvancedMarker>
        )}
        {end && (
          <AdvancedMarker position={end} title="Trip ended here" zIndex={40}>
            <MapPin variant="end" />
          </AdvancedMarker>
        )}
      </GoogleMap>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-3 rounded-lg bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border-[3px] border-blue-700 bg-white" /> Start
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> End
        </span>
        {routePath ? (
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-1 rounded bg-[#5b3bff]/50" /> Planned route
          </span>
        ) : (
          !routeLoading && (
            <span className="text-slate-400">{trip.routeId ? 'Route no longer exists' : 'No route on file'}</span>
          )
        )}
      </div>
    </div>
  );
}
