import { useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, OverlayViewF, OverlayView, PolylineF } from '@react-google-maps/api';
import { CarFront, Loader2, Maximize2 } from 'lucide-react';
import { formatDistance, formatTravelTime } from '../utils/format';
import { MAP_ID } from '../hooks/useGoogleMaps';
import AdvancedMarker from './AdvancedMarker';
import MapPin from './MapPin';

const CONTAINER_STYLE = { width: '100%', height: '100%' };
const DEFAULT_CENTER = { lat: 14.28, lng: 120.93 }; // Cavite
const DEFAULT_ZOOM = 10;

const ROUTE_OUTLINE = { strokeColor: '#2a12a8', strokeOpacity: 0.9, strokeWeight: 8, clickable: false, zIndex: 1 };
const ROUTE_LINE = { strokeColor: '#5b3bff', strokeOpacity: 1, strokeWeight: 5, clickable: false, zIndex: 2 };

const calloutOffset = (width, height) => ({ x: -(width / 2), y: -(height + 12) });

function fitToPoints(map, points) {
  if (!map || points.length === 0) return;
  if (points.length === 1) {
    map.panTo(points[0]);
    map.setZoom(14);
    return;
  }
  const bounds = new window.google.maps.LatLngBounds();
  points.forEach((point) => bounds.extend(point));
  map.fitBounds(bounds, 48);
}

/**
 * Editable route map: draggable start / waypoint / end markers, the calculated
 * road-following polyline, and a duration/distance callout.
 *
 * - `pickLabel` (string | null): when set, the map is in "pick" mode — the
 *   cursor becomes a crosshair and the next map click calls onMapPick(lat, lng).
 * - Dragging a marker calls onMarkerMove(target, lat, lng), where target is
 *   'start' | 'end' | a waypoint id.
 * Must only be rendered after the Maps API has loaded.
 */
export default function RouteEditorMap({ start, end, waypoints, route, routeLoading, pickLabel, onMapPick, onMarkerMove }) {
  const [map, setMap] = useState(null);
  const hasFittedRef = useRef(false);

  const placedPoints = useMemo(
    () => [start, ...waypoints, end].filter((p) => p && p.lat != null).map(({ lat, lng }) => ({ lat, lng })),
    [start, waypoints, end],
  );

  // Frame the route once, the first time one is available — not on every
  // drag, which would yank the view around while the operator is editing.
  useEffect(() => {
    if (!map || hasFittedRef.current || !route?.coordinates?.length) return;
    fitToPoints(map, route.coordinates);
    hasFittedRef.current = true;
  }, [map, route]);

  const options = useMemo(
    () => ({
      mapId: MAP_ID,
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      clickableIcons: false,
      draggableCursor: pickLabel ? 'crosshair' : undefined,
    }),
    [pickLabel],
  );

  const midpoint = route?.coordinates?.length ? route.coordinates[Math.floor(route.coordinates.length / 2)] : null;

  const handleDragEnd = (target) => (lat, lng) => onMarkerMove(target, lat, lng);

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={CONTAINER_STYLE}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        options={options}
        onLoad={setMap}
        onUnmount={() => setMap(null)}
        onClick={(event) => {
          if (pickLabel && event.latLng) onMapPick(event.latLng.lat(), event.latLng.lng());
        }}
      >
        {route?.coordinates?.length > 0 && (
          <>
            <PolylineF path={route.coordinates} options={ROUTE_OUTLINE} />
            <PolylineF path={route.coordinates} options={ROUTE_LINE} />
          </>
        )}

        {start?.lat != null && (
          <AdvancedMarker
            position={{ lat: start.lat, lng: start.lng }}
            title={start.name || 'Starting destination'}
            anchor="center"
            draggable
            zIndex={30}
            onDragEnd={handleDragEnd('start')}
          >
            <MapPin variant="start" draggable />
          </AdvancedMarker>
        )}

        {waypoints.map((waypoint, index) =>
          waypoint.lat != null ? (
            <AdvancedMarker
              key={waypoint.id}
              position={{ lat: waypoint.lat, lng: waypoint.lng }}
              title={waypoint.name || `Stop ${index + 1}`}
              anchor="center"
              draggable
              zIndex={20}
              onDragEnd={handleDragEnd(waypoint.id)}
            >
              <MapPin variant="waypoint" label={index + 1} draggable />
            </AdvancedMarker>
          ) : null,
        )}

        {end?.lat != null && (
          <AdvancedMarker
            position={{ lat: end.lat, lng: end.lng }}
            title={end.name || 'Ending destination'}
            draggable
            zIndex={40}
            onDragEnd={handleDragEnd('end')}
          >
            <MapPin variant="end" draggable />
          </AdvancedMarker>
        )}

        {midpoint && (
          <OverlayViewF position={midpoint} mapPaneName={OverlayView.FLOAT_PANE} getPixelPositionOffset={calloutOffset}>
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-md shadow-md px-2.5 py-1.5 whitespace-nowrap pointer-events-none">
              <CarFront className="w-4 h-4 text-slate-700" />
              <div className="leading-tight">
                <p className="text-xs font-bold text-slate-900">{formatTravelTime(route.durationSeconds)}</p>
                <p className="text-[10px] text-slate-500">{formatDistance(route.distanceMeters)}</p>
              </div>
            </div>
          </OverlayViewF>
        )}
      </GoogleMap>

      {/* Pick-mode hint */}
      {pickLabel && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/85 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg pointer-events-none">
          Click the map to place {pickLabel} · Esc to cancel
        </div>
      )}

      {/* Route recalculating */}
      {routeLoading && (
        <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-white/95 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          Calculating route…
        </div>
      )}

      {/* Fit route */}
      {placedPoints.length > 0 && (
        <button
          type="button"
          onClick={() => fitToPoints(map, route?.coordinates?.length ? route.coordinates : placedPoints)}
          title="Fit route to view"
          aria-label="Fit route to view"
          className="absolute top-3 right-3 p-2 bg-white text-slate-700 hover:text-blue-600 rounded-lg shadow cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
