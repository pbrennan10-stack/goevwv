// Small geographic helpers. Used to filter chargers by proximity to a route
// polyline without calling a paid matrix API. Haversine is accurate to ~0.5%
// at the distances involved (tens of miles), well within the margin of what
// "near my route" means.

const EARTH_RADIUS_MI = 3958.8;

/** Great-circle distance between two [lng, lat] points, in miles. */
export function haversineMi(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const lat1r = toRad(lat1);
  const lat2r = toRad(lat2);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1r) * Math.cos(lat2r) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_MI * c;
}

/**
 * Minimum great-circle distance (in miles) between a point and a polyline of
 * [lng, lat] coordinates. Walks every vertex of the polyline — fine for our
 * scale (~50–200 chargers × polylines of ~500–2000 points finishes in a few
 * ms). Returns Infinity for empty polylines.
 *
 * This approximates route proximity to each vertex. Because Mapbox returns
 * dense geometry (many points per mile), this is plenty accurate for
 * "is this charger within N miles of my route" decisions.
 */
export function minDistanceToRouteMi(
  point: [number, number],
  route: [number, number][],
): number {
  if (!route.length) return Infinity;
  let best = Infinity;
  for (const v of route) {
    const d = haversineMi(point, v);
    if (d < best) best = d;
  }
  return best;
}
