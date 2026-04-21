"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Charger, NormalizedConnectorType } from "@/lib/chargers";
import { minDistanceToRouteMi } from "@/lib/geo";

interface Props {
  chargers: Charger[];
  mapboxToken: string;
  initialOrigin?: [number, number] | null;
  initialDestination?: [number, number] | null;
  initialBufferMi?: number;
  returnUrl?: string | null;
}

const CONNECTOR_LIST: NormalizedConnectorType[] = [
  "CCS",
  "NACS",
  "Tesla",
  "CHAdeMO",
  "J1772",
  "Other",
];

const CONNECTOR_LABEL: Record<NormalizedConnectorType, string> = {
  CCS: "CCS",
  NACS: "NACS",
  Tesla: "Tesla (legacy)",
  CHAdeMO: "CHAdeMO",
  J1772: "J1772 (L2)",
  Other: "Other",
};

// WV fits inside this bounding box with a small buffer.
const WV_CENTER: [number, number] = [-80.5, 38.85];
const WV_ZOOM = 6.6;

// Mapbox endpoints — same family used by RouteHelper.
const GEO_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";
const DIR_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";
// Box covers WV + a buffer for routes that cross the border (Pittsburgh, DC, Columbus, etc.)
const GEO_BBOX = "-84,36.5,-76,41";
const ROUTE_LINE_LAYER = "route-line";
const ROUTE_SOURCE = "route-source";

interface Suggestion {
  id: string;
  place_name: string;
  center: [number, number];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPopupHtml(c: Charger): string {
  const name = escapeHtml(c.name);
  const addr = [c.address, c.town, c.state].filter(Boolean).join(", ");
  const operator = c.operator ? escapeHtml(c.operator) : "Operator not listed";
  const power = c.max_power_kw > 0 ? `${Math.round(c.max_power_kw)} kW peak` : "Power not listed";
  const speedBadge = c.is_dcfc
    ? '<span style="background:#059669;color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;letter-spacing:.05em;">DCFC</span>'
    : '<span style="background:#94a3b8;color:#fff;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;letter-spacing:.05em;">L2</span>';

  const connectorList = c.connectors
    .map((k) => {
      const label = escapeHtml(CONNECTOR_LABEL[k.type] ?? k.type);
      const kw = k.power_kw ? ` · ${Math.round(k.power_kw)} kW` : "";
      const qty = k.quantity > 1 ? ` × ${k.quantity}` : "";
      return `<li>${label}${kw}${qty}</li>`;
    })
    .join("");

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}`;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 220px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
        ${speedBadge}
        <strong style="font-size:14px;color:#0f172a;">${name}</strong>
      </div>
      <div style="font-size:12px;color:#475569;margin-bottom:6px;">${escapeHtml(operator)} · ${power}</div>
      ${addr ? `<div style="font-size:12px;color:#64748b;margin-bottom:8px;">${escapeHtml(addr)}</div>` : ""}
      ${connectorList ? `<ul style="margin:4px 0 8px 18px;padding:0;font-size:12px;color:#334155;">${connectorList}</ul>` : ""}
      <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;">
        <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer"
           style="color:#059669;font-weight:600;text-decoration:underline;">
           Directions →
        </a>
        <a href="${c.ocm_url}" target="_blank" rel="noopener noreferrer"
           style="color:#475569;text-decoration:underline;">
           OpenChargeMap
        </a>
      </div>
    </div>
  `;
}

export function ChargerMap({
  chargers,
  mapboxToken,
  initialOrigin = null,
  initialDestination = null,
  initialBufferMi = 10,
  returnUrl = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  // Existing filter state.
  const [dcfcOnly, setDcfcOnly] = useState(false);
  const [connectorFilters, setConnectorFilters] = useState<
    Record<NormalizedConnectorType, boolean>
  >({
    CCS: true,
    NACS: true,
    Tesla: true,
    CHAdeMO: true,
    J1772: true,
    Other: true,
  });

  // Route-input state.
  const [originText, setOriginText] = useState("");
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(initialOrigin);
  const [originSugg, setOriginSugg] = useState<Suggestion[]>([]);
  const [destText, setDestText] = useState("");
  const [destCoords, setDestCoords] = useState<[number, number] | null>(initialDestination);
  const [destSugg, setDestSugg] = useState<Suggestion[]>([]);
  const [routeLine, setRouteLine] = useState<[number, number][] | null>(null);
  const [routeMiles, setRouteMiles] = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [bufferMi, setBufferMi] = useState(initialBufferMi);

  const originTimer = useRef<ReturnType<typeof setTimeout>>();
  const destTimer = useRef<ReturnType<typeof setTimeout>>();
  const autoLoadedRef = useRef(false);

  // Pre-compute distance-to-route for every charger when the route changes.
  // Memoizing here avoids recomputing during filter toggles.
  const distancesByChargerId = useMemo(() => {
    if (!routeLine) return null;
    const m = new Map<number, number>();
    for (const c of chargers) {
      m.set(c.id, minDistanceToRouteMi([c.lng, c.lat], routeLine));
    }
    return m;
  }, [routeLine, chargers]);

  // Visible = chargers passing the connector/DCFC filters. Route filter is
  // applied as a *highlight* (dimmed outside buffer), not a hard hide, so
  // users still see the full network as context.
  const visible = useMemo(() => {
    return chargers.filter((c) => {
      if (dcfcOnly && !c.is_dcfc) return false;
      if (!c.connector_types.some((t) => connectorFilters[t])) return false;
      return true;
    });
  }, [chargers, dcfcOnly, connectorFilters]);

  const visibleCount = visible.length;
  const dcfcCount = useMemo(() => visible.filter((c) => c.is_dcfc).length, [visible]);

  // When a route is active, count chargers within the buffer (for the summary).
  const nearRouteCount = useMemo(() => {
    if (!distancesByChargerId) return null;
    let dcfc = 0;
    let l2 = 0;
    for (const c of visible) {
      const d = distancesByChargerId.get(c.id) ?? Infinity;
      if (d > bufferMi) continue;
      if (c.is_dcfc) dcfc += 1;
      else l2 += 1;
    }
    return { dcfc, l2 };
  }, [distancesByChargerId, visible, bufferMi]);

  const geocode = useCallback(
    async (q: string): Promise<Suggestion[]> => {
      if (q.length < 3) return [];
      const url = `${GEO_URL}/${encodeURIComponent(q)}.json?access_token=${mapboxToken}&country=US&bbox=${GEO_BBOX}&types=address,place&limit=5`;
      try {
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.features ?? []).map(
          (f: { id: string; place_name: string; center: [number, number] }) => ({
            id: f.id,
            place_name: f.place_name,
            center: f.center,
          }),
        );
      } catch {
        return [];
      }
    },
    [mapboxToken],
  );

  const onOriginChange = useCallback(
    (val: string) => {
      setOriginText(val);
      setOriginCoords(null);
      setRouteLine(null);
      setRouteMiles(null);
      clearTimeout(originTimer.current);
      originTimer.current = setTimeout(async () => {
        setOriginSugg(await geocode(val));
      }, 350);
    },
    [geocode],
  );

  const onDestChange = useCallback(
    (val: string) => {
      setDestText(val);
      setDestCoords(null);
      setRouteLine(null);
      setRouteMiles(null);
      clearTimeout(destTimer.current);
      destTimer.current = setTimeout(async () => {
        setDestSugg(await geocode(val));
      }, 350);
    },
    [geocode],
  );

  const fetchRoute = useCallback(
    async (origin: [number, number], destination: [number, number]) => {
      setRouteLoading(true);
      setRouteError(null);
      try {
        const coords = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
        const url = `${DIR_URL}/${coords}?geometries=geojson&overview=full&access_token=${mapboxToken}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Route lookup failed — check your Mapbox token.");
        const data = await res.json();
        if (!data.routes?.[0]) {
          throw new Error("No driving route found between these two locations.");
        }
        const route = data.routes[0];
        const distance_mi = route.distance / 1609.344;
        const lineCoords = route.geometry.coordinates as [number, number][];
        setRouteLine(lineCoords);
        setRouteMiles(distance_mi);
      } catch (e) {
        setRouteError(e instanceof Error ? e.message : "Route lookup failed.");
        setRouteLine(null);
        setRouteMiles(null);
      } finally {
        setRouteLoading(false);
      }
    },
    [mapboxToken],
  );

  const onGetRoute = useCallback(() => {
    if (!originCoords || !destCoords) return;
    fetchRoute(originCoords, destCoords);
  }, [originCoords, destCoords, fetchRoute]);

  const onClearRoute = useCallback(() => {
    setRouteLine(null);
    setRouteMiles(null);
    setOriginText("");
    setDestText("");
    setOriginCoords(null);
    setDestCoords(null);
    setOriginSugg([]);
    setDestSugg([]);
    setRouteError(null);
  }, []);

  // Auto-load route on first mount if origin + destination provided via URL params.
  useEffect(() => {
    if (autoLoadedRef.current) return;
    if (initialOrigin && initialDestination) {
      autoLoadedRef.current = true;
      fetchRoute(initialOrigin, initialDestination);
    }
  }, [initialOrigin, initialDestination, fetchRoute]);

  // URL sync — keep o/d/br/return in the address bar so the page is shareable.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams();
    if (originCoords) p.set("o", `${originCoords[0].toFixed(5)},${originCoords[1].toFixed(5)}`);
    if (destCoords) p.set("d", `${destCoords[0].toFixed(5)},${destCoords[1].toFixed(5)}`);
    if (bufferMi !== 10) p.set("br", String(bufferMi));
    if (returnUrl) p.set("return", returnUrl);
    const qs = p.toString();
    const newUrl = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
  }, [originCoords, destCoords, bufferMi, returnUrl]);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: WV_CENTER,
      zoom: WV_ZOOM,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");

    map.on("load", () => {
      // Route line — added BEFORE chargers so chargers render on top.
      map.addSource(ROUTE_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: ROUTE_LINE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#059669",
          "line-width": 4,
          "line-opacity": 0.85,
        },
      });

      // Charger points — paint uses `near_route` feature property to dim
      // out-of-buffer chargers when a route is active. When no route is set,
      // every feature has near_route=true so opacity stays at full.
      map.addSource("chargers", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "charger-points",
        type: "circle",
        source: "chargers",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            3,
            10,
            6,
            14,
            9,
          ],
          "circle-color": [
            "case",
            ["get", "is_dcfc"],
            "#059669",
            "#94a3b8",
          ],
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": [
            "case",
            ["get", "near_route"],
            0.9,
            0.25,
          ],
        },
      });

      map.on("click", "charger-points", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const id = feature.properties?.id;
        const charger = chargers.find((c) => c.id === id);
        if (!charger) return;

        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({ closeButton: true, maxWidth: "320px" })
          .setLngLat([charger.lng, charger.lat])
          .setHTML(buildPopupHtml(charger))
          .addTo(map);
      });

      map.on("mouseenter", "charger-points", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "charger-points", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    mapRef.current = map;
    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken, chargers]);

  // Push filtered + buffer-aware data to map source whenever inputs change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pushData = () => {
      // Charger points
      const chargerSrc = map.getSource("chargers") as mapboxgl.GeoJSONSource | undefined;
      if (chargerSrc) {
        chargerSrc.setData({
          type: "FeatureCollection",
          features: visible.map((c) => {
            const dist = distancesByChargerId?.get(c.id);
            const nearRoute =
              !distancesByChargerId || (dist !== undefined && dist <= bufferMi);
            return {
              type: "Feature",
              geometry: { type: "Point", coordinates: [c.lng, c.lat] },
              properties: { id: c.id, is_dcfc: c.is_dcfc, near_route: nearRoute },
            };
          }),
        });
      }

      // Route line
      const routeSrc = map.getSource(ROUTE_SOURCE) as mapboxgl.GeoJSONSource | undefined;
      if (routeSrc) {
        routeSrc.setData(
          routeLine
            ? {
                type: "Feature",
                geometry: { type: "LineString", coordinates: routeLine },
                properties: {},
              }
            : { type: "FeatureCollection", features: [] },
        );
      }

      // Fit map to route bounds when a new route loads.
      if (routeLine && routeLine.length > 0) {
        const bounds = routeLine.reduce(
          (b, coord) => b.extend(coord as [number, number]),
          new mapboxgl.LngLatBounds(routeLine[0], routeLine[0]),
        );
        map.fitBounds(bounds, { padding: 60, duration: 600 });
      }
    };
    if (map.isStyleLoaded()) {
      pushData();
    } else {
      map.once("load", pushData);
    }
  }, [visible, distancesByChargerId, bufferMi, routeLine]);

  function toggleConnector(t: NormalizedConnectorType) {
    setConnectorFilters((prev) => ({ ...prev, [t]: !prev[t] }));
  }

  function selectOrigin(s: Suggestion) {
    setOriginText(s.place_name);
    setOriginCoords(s.center);
    setOriginSugg([]);
  }

  function selectDest(s: Suggestion) {
    setDestText(s.place_name);
    setDestCoords(s.center);
    setDestSugg([]);
  }

  if (!mapboxToken) {
    return (
      <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-5 text-sm text-amber-900">
        Map unavailable: Mapbox token not configured.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Back-to-calc link, only when arrived from /calculator */}
      {returnUrl && (
        <div className="rounded-xl bg-brand-bg ring-1 ring-brand/30 p-3 text-sm">
          <Link
            href={returnUrl}
            className="font-medium text-brand-dark hover:underline inline-flex items-center gap-1"
          >
            ← Back to your calculation
          </Link>
          <span className="text-ink-muted ml-2">
            — your inputs are preserved.
          </span>
        </div>
      )}

      {/* Route input bar */}
      <div className="rounded-xl bg-white ring-1 ring-slate-200 p-3 sm:p-4">
        <div className="text-xs uppercase tracking-wider text-ink-soft font-semibold mb-2">
          Find chargers on your route
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <AddressField
            label="From"
            value={originText}
            suggestions={originSugg}
            onChange={onOriginChange}
            onSelect={selectOrigin}
          />
          <AddressField
            label="To"
            value={destText}
            suggestions={destSugg}
            onChange={onDestChange}
            onSelect={selectDest}
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-3">
          <button
            type="button"
            onClick={onGetRoute}
            disabled={!originCoords || !destCoords || routeLoading}
            className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium disabled:opacity-40 hover:opacity-90 transition"
          >
            {routeLoading ? "Loading route…" : "Get route"}
          </button>
          {routeLine && (
            <>
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                Show chargers within
                <input
                  type="range"
                  min={1}
                  max={25}
                  step={1}
                  value={bufferMi}
                  onChange={(e) => setBufferMi(Number(e.target.value))}
                  className="accent-brand"
                />
                <span className="w-10 text-right tabular-nums text-ink font-medium">
                  {bufferMi} mi
                </span>
              </label>
              <button
                type="button"
                onClick={onClearRoute}
                className="text-sm text-ink-soft underline hover:text-ink"
              >
                Clear route
              </button>
            </>
          )}
          {routeError && (
            <span className="text-sm text-red-600">{routeError}</span>
          )}
        </div>
        {routeLine && nearRouteCount && routeMiles != null && (
          <p className="mt-3 text-sm text-ink">
            <strong className="text-brand-dark">{nearRouteCount.dcfc}</strong> DCFC
            {" and "}
            <strong>{nearRouteCount.l2}</strong> L2 within{" "}
            {bufferMi} mi of your{" "}
            <strong>{Math.round(routeMiles)}</strong> mi one-way route.
          </p>
        )}
      </div>

      {/* Filter bar */}
      <div className="rounded-xl bg-white ring-1 ring-slate-200 p-3 sm:p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="text-sm text-ink-muted">
            Showing <strong className="text-ink tabular-nums">{visibleCount}</strong>{" "}
            of {chargers.length} stations
            {visibleCount > 0 && (
              <span className="text-ink-soft"> · {dcfcCount} DCFC</span>
            )}
          </div>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={dcfcOnly}
              onChange={(e) => setDcfcOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            <span className="text-ink">DCFC only (fast chargers)</span>
          </label>
        </div>
        <div className="flex items-center flex-wrap gap-3">
          <span className="text-xs text-ink-soft uppercase tracking-wider font-semibold">
            Connectors:
          </span>
          {CONNECTOR_LIST.map((t) => (
            <label key={t} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={connectorFilters[t]}
                onChange={() => toggleConnector(t)}
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
              />
              <span className="text-ink">{CONNECTOR_LABEL[t]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Map */}
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden ring-1 ring-slate-200"
        style={{ height: "520px", minHeight: "400px" }}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-ink-muted flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: "#059669" }}
          />
          DCFC (fast charging)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: "#94a3b8" }}
          />
          L2 (home-style, slower)
        </span>
        {routeLine && (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-1 w-6 rounded-full"
              style={{ background: "#059669" }}
            />
            Your route · dimmed pins are outside the buffer
          </span>
        )}
        <span className="text-ink-soft">· Click a pin for details</span>
      </div>
    </div>
  );
}

function AddressField({
  label,
  value,
  suggestions,
  onChange,
  onSelect,
}: {
  label: string;
  value: string;
  suggestions: Suggestion[];
  onChange: (v: string) => void;
  onSelect: (s: Suggestion) => void;
}) {
  return (
    <div className="relative">
      <label className="block text-xs font-medium text-ink-muted mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Start typing an address or city…"
        autoComplete="off"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink shadow-sm focus:border-brand focus:outline-none bg-white"
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={() => onSelect(s)}
                className="w-full px-3 py-3 text-left text-sm text-ink hover:bg-sky-50 focus:bg-sky-100 focus:outline-none truncate"
              >
                {s.place_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
