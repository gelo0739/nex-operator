import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGoogleMap } from '@react-google-maps/api';

/**
 * Renders `children` on the map at `position`, in the float pane (above
 * markers). Unlike OverlayViewF — which builds a new google.maps.OverlayView
 * (detaching and re-attaching its DOM) whenever the `position` object
 * changes — this keeps ONE overlay per map and only moves it, so the content
 * never remounts while the bus moves or the parent re-renders.
 *
 * The content's bottom-center sits `offsetY` px above the position.
 * Must be rendered inside <GoogleMap>.
 */
export default function FloatingOverlay({ position, offsetY = 0, children }) {
  const map = useGoogleMap();
  const [container] = useState(() => {
    const div = document.createElement('div');
    div.style.position = 'absolute';
    return div;
  });
  const overlayRef = useRef(null);
  const positionRef = useRef(position);

  const lat = position?.lat;
  const lng = position?.lng;

  useEffect(() => {
    positionRef.current = lat != null && lng != null ? { lat, lng } : null;
  }, [lat, lng]);

  // One overlay per map.
  useEffect(() => {
    if (!map) return undefined;
    class Overlay extends window.google.maps.OverlayView {
      onAdd() {
        this.getPanes()?.floatPane.appendChild(container);
      }
      draw() {
        const projection = this.getProjection();
        const pos = positionRef.current;
        if (!projection || !pos) return;
        const point = projection.fromLatLngToDivPixel(new window.google.maps.LatLng(pos.lat, pos.lng));
        if (!point) return;
        container.style.left = `${point.x}px`;
        container.style.top = `${point.y}px`;
      }
      onRemove() {
        container.remove();
      }
    }
    const overlay = new Overlay();
    overlay.setMap(map);
    overlayRef.current = overlay;
    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map, container]);

  // Move (don't rebuild) when the coordinates change.
  useEffect(() => {
    overlayRef.current?.draw();
  }, [lat, lng]);

  return createPortal(
    <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(-50%, calc(-100% - ${offsetY}px))` }}>
      {children}
    </div>,
    container,
  );
}
