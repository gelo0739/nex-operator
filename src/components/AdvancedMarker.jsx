import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGoogleMap } from '@react-google-maps/api';

/**
 * React wrapper around google.maps.marker.AdvancedMarkerElement (the
 * replacement for the deprecated google.maps.Marker). `children` is rendered
 * as the marker's content, so pins can be styled with Tailwind.
 *
 * Must be rendered inside <GoogleMap> whose options include a `mapId`, with
 * the "marker" library loaded (see hooks/useGoogleMaps.js).
 *
 * - `anchor`: 'bottom' (default) puts the content's bottom-center on the
 *   position — right for teardrop pins. 'center' centers it — right for dots.
 * - `onDragEnd(lat, lng)` fires after the operator drops a draggable marker.
 */
export default function AdvancedMarker({ position, draggable = false, onDragEnd, title, zIndex, anchor = 'bottom', children }) {
  const map = useGoogleMap();
  const [container] = useState(() => document.createElement('div'));
  const markerRef = useRef(null);
  const onDragEndRef = useRef(onDragEnd);

  useEffect(() => {
    onDragEndRef.current = onDragEnd;
  }, [onDragEnd]);

  // Create the marker once per map. The sync effects below are declared after
  // this one (and also depend on `map`), so they run right after it in the same
  // commit and apply the current props to the new marker.
  useEffect(() => {
    if (!map) return undefined;
    const marker = new window.google.maps.marker.AdvancedMarkerElement({ map, content: container });
    const listener = marker.addListener('dragend', (event) => {
      const latLng = event?.latLng ?? marker.position;
      const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
      const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
      onDragEndRef.current?.(lat, lng);
    });
    markerRef.current = marker;
    return () => {
      listener.remove();
      marker.map = null;
      markerRef.current = null;
    };
  }, [map, container]);

  const lat = position?.lat;
  const lng = position?.lng;
  useEffect(() => {
    if (markerRef.current) markerRef.current.position = lat != null && lng != null ? { lat, lng } : null;
  }, [map, lat, lng]);

  useEffect(() => {
    if (markerRef.current) markerRef.current.gmpDraggable = draggable;
  }, [map, draggable]);

  useEffect(() => {
    if (markerRef.current) markerRef.current.title = title ?? '';
  }, [map, title]);

  useEffect(() => {
    if (markerRef.current) markerRef.current.zIndex = zIndex ?? null;
  }, [map, zIndex]);

  return createPortal(
    <div style={anchor === 'center' ? { transform: 'translateY(50%)' } : undefined}>{children}</div>,
    container,
  );
}
