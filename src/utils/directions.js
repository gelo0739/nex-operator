// Google Maps JS API helpers for the route editor. Call these only after the
// API has loaded (useGoogleMaps().isLoaded), since they read window.google.maps.
//
// We use the JS API's DirectionsService / Geocoder rather than the REST
// endpoints because those don't send CORS headers and can't be called from
// the browser. Requires the Directions API and Geocoding API to be enabled on
// the Maps key.

// How far (in degrees) Google's snapped route endpoint may drift from a pin
// before we stitch the exact pin on as its own point (~11 m).
const PIN_SNAP_THRESHOLD_DEG = 0.0001;

const getMaps = () => {
  const maps = window.google?.maps;
  if (!maps) throw new Error("Google Maps has not loaded yet.");
  return maps;
};

// Returns { coordinates: [{lat, lng}], distanceMeters, durationSeconds } for
// the driving route from origin through `waypoints` (pass-through points, not
// stops) to destination. All points are { lat, lng } pins. The exact start/end
// pins are spliced onto Google's road-following polyline so the route begins
// and ends exactly where the operator placed them.
export const fetchDrivingRoute = async (origin, destination, waypoints = []) => {
  const maps = getMaps();
  const directionsService = new maps.DirectionsService();

  const result = await directionsService.route({
    origin: new maps.LatLng(origin.lat, origin.lng),
    destination: new maps.LatLng(destination.lat, destination.lng),
    waypoints: waypoints.map((point) => ({
      location: new maps.LatLng(point.lat, point.lng),
      stopover: false,
    })),
    travelMode: maps.TravelMode.DRIVING,
  });

  const route = result.routes?.[0];
  if (!route) throw new Error("No driving route found between these points.");

  const coordinates = route.overview_path.map((point) => ({ lat: point.lat(), lng: point.lng() }));

  const first = coordinates[0];
  if (!first || Math.hypot(first.lat - origin.lat, first.lng - origin.lng) > PIN_SNAP_THRESHOLD_DEG) {
    coordinates.unshift({ lat: origin.lat, lng: origin.lng });
  } else {
    coordinates[0] = { lat: origin.lat, lng: origin.lng };
  }

  const last = coordinates[coordinates.length - 1];
  if (!last || Math.hypot(last.lat - destination.lat, last.lng - destination.lng) > PIN_SNAP_THRESHOLD_DEG) {
    coordinates.push({ lat: destination.lat, lng: destination.lng });
  } else {
    coordinates[coordinates.length - 1] = { lat: destination.lat, lng: destination.lng };
  }

  // Waypoints split the trip into multiple legs, so sum across all of them.
  const distanceMeters = route.legs.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0);
  const durationSeconds = route.legs.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0);

  return { coordinates, distanceMeters, durationSeconds };
};

// Prefer a human-friendly short name: a named place, else the
// neighborhood/locality, else the first part of the formatted address.
const PREFERRED_TYPES = [
  "bus_station",
  "transit_station",
  "shopping_mall",
  "establishment",
  "point_of_interest",
  "neighborhood",
  "sublocality",
  "locality",
];

const shortName = (result) => {
  const components = result.address_components || [];
  const locality = components.find((c) => c.types.includes("locality"));
  for (const type of PREFERRED_TYPES) {
    const component = components.find((c) => c.types.includes(type));
    if (component) {
      return locality && locality.long_name !== component.long_name
        ? `${component.long_name}, ${locality.long_name}`
        : component.long_name;
    }
  }
  return result.formatted_address?.split(",").slice(0, 2).join(",").trim() || null;
};

// Resolves to a short place name for a { lat, lng }, or null if the lookup fails.
export const reverseGeocode = async ({ lat, lng }) => {
  try {
    const maps = getMaps();
    const geocoder = new maps.Geocoder();
    const { results } = await geocoder.geocode({ location: { lat, lng } });
    if (!results?.length) return null;
    // Results come most-specific first. Skip bare plus codes and road-only hits.
    const best =
      results.find((r) => !r.types.includes("plus_code") && !r.types.includes("route")) || results[0];
    return shortName(best);
  } catch (error) {
    console.warn("Reverse geocoding failed:", error);
    return null;
  }
};
