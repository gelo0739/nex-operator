// Route display names, shared by every page that lists or filters routes.

// "Alfonso, Cavite to PITX" from a route doc; falls back to its name.
export const routeLabel = (route, fallback = "") =>
  route?.startDestination && route?.endDestination
    ? `${route.startDestination} to ${route.endDestination}`
    : route?.name || fallback;

// "Alfonso, Cavite - PITX, Parañaque" → "Alfonso-PITX" (or "Alfonso to PITX"
// with separator " to ") — the short form used in tables.
export const shortRouteName = (name, separator = "-") => {
  if (typeof name !== "string" || !name) return "—";
  const parts = name.split(" - ");
  return parts.length === 2 ? parts.map((p) => p.split(",")[0].trim()).join(separator) : name;
};
