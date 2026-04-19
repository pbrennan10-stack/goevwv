"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Charger, NormalizedConnectorType } from "@/lib/chargers";

interface Props {
  chargers: Charger[];
  mapboxToken: string;
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

  // Google Maps navigation URL that works on web, iOS, and Android — OS opens
  // the right maps app. Using coordinates is more reliable than the address
  // string (OCM addresses are sometimes incomplete).
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

export function ChargerMap({ chargers, mapboxToken }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

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

  const visible = useMemo(() => {
    return chargers.filter((c) => {
      if (dcfcOnly && !c.is_dcfc) return false;
      if (!c.connector_types.some((t) => connectorFilters[t])) return false;
      return true;
    });
  }, [chargers, dcfcOnly, connectorFilters]);

  const visibleCount = visible.length;
  const dcfcCount = useMemo(() => visible.filter((c) => c.is_dcfc).length, [visible]);

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
          "circle-opacity": 0.9,
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

  // Push filtered data to map source whenever the visible set changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pushData = () => {
      const src = map.getSource("chargers") as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData({
        type: "FeatureCollection",
        features: visible.map((c) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [c.lng, c.lat] },
          properties: { id: c.id, is_dcfc: c.is_dcfc },
        })),
      });
    };
    if (map.isStyleLoaded()) {
      pushData();
    } else {
      map.once("load", pushData);
    }
  }, [visible]);

  function toggleConnector(t: NormalizedConnectorType) {
    setConnectorFilters((prev) => ({ ...prev, [t]: !prev[t] }));
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
        <span className="text-ink-soft">· Click a pin for details</span>
      </div>
    </div>
  );
}
