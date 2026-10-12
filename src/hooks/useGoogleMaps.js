import { useJsApiLoader } from "@react-google-maps/api";

// Every page must load the Maps JS API with the SAME options — @react-google-maps
// throws if a second loader with the same id asks for different libraries.
// Keep this array module-level so its identity never changes between renders.
// "marker" provides AdvancedMarkerElement (see components/AdvancedMarker.jsx).
const LIBRARIES = ["marker"];

// Advanced markers require a Map ID. DEMO_MAP_ID works for development; create
// a real one in Google Cloud (Google Maps Platform → Map management) for production.
export const MAP_ID = import.meta.env.VITE_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

export default function useGoogleMaps() {
  return useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: LIBRARIES,
  });
}
