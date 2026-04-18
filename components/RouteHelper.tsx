"use client";

import { useCallback, useRef, useState } from "react";
import type { RouteData } from "@/lib/types";

const GEO_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";
const DIR_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";
// Bounding box covering WV + neighbouring border areas
const BBOX = "-84,36.5,-76,41";
// Segment speed ≥ 24.6 m/s (≈55 mph) counted as highway
const HIGHWAY_MS = 24.6;

interface Suggestion {
  id: string;
  place_name: string;
  center: [number, number];
}

interface Props {
  token: string;
  onFill: (r: RouteData) => void;
}

export function RouteHelper({ token, onFill }: Props) {
  const [open, setOpen] = useState(false);

  const [homeText, setHomeText] = useState("");
  const [homeCoords, setHomeCoords] = useState<[number, number] | null>(null);
  const [homeSugg, setHomeSugg] = useState<Suggestion[]>([]);

  const [workText, setWorkText] = useState("");
  const [workCoords, setWorkCoords] = useState<[number, number] | null>(null);
  const [workSugg, setWorkSugg] = useState<Suggestion[]>([]);

  const [result, setResult] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const homeTimer = useRef<ReturnType<typeof setTimeout>>();
  const workTimer = useRef<ReturnType<typeof setTimeout>>();

  const geocode = useCallback(
    async (q: string): Promise<Suggestion[]> => {
      if (q.length < 3) return [];
      const url = `${GEO_URL}/${encodeURIComponent(q)}.json?access_token=${token}&country=US&bbox=${BBOX}&types=address,place&limit=5`;
      try {
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.features ?? []).map((f: { id: string; place_name: string; center: [number, number] }) => ({
          id: f.id,
          place_name: f.place_name,
          center: f.center,
        }));
      } catch {
        return [];
      }
    },
    [token],
  );

  const onHomeChange = useCallback(
    (val: string) => {
      setHomeText(val);
      setHomeCoords(null);
      setResult(null);
      clearTimeout(homeTimer.current);
      homeTimer.current = setTimeout(async () => {
        setHomeSugg(await geocode(val));
      }, 350);
    },
    [geocode],
  );

  const onWorkChange = useCallback(
    (val: string) => {
      setWorkText(val);
      setWorkCoords(null);
      setResult(null);
      clearTimeout(workTimer.current);
      workTimer.current = setTimeout(async () => {
        setWorkSugg(await geocode(val));
      }, 350);
    },
    [geocode],
  );

  const selectHome = useCallback((s: Suggestion) => {
    setHomeText(s.place_name);
    setHomeCoords(s.center);
    setHomeSugg([]);
  }, []);

  const selectWork = useCallback((s: Suggestion) => {
    setWorkText(s.place_name);
    setWorkCoords(s.center);
    setWorkSugg([]);
  }, []);

  const getRoute = useCallback(async () => {
    if (!homeCoords || !workCoords) return;
    setLoading(true);
    setError(null);
    try {
      const coords = `${homeCoords[0]},${homeCoords[1]};${workCoords[0]},${workCoords[1]}`;
      const url = `${DIR_URL}/${coords}?geometries=geojson&overview=full&annotations=speed,distance&access_token=${token}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Route lookup failed — check your Mapbox token.");
      const data = await res.json();
      if (!data.routes?.[0]) throw new Error("No driving route found between these two locations.");

      const route = data.routes[0];
      const distance_mi = route.distance / 1609.344;

      // Highway fraction from per-segment speed annotations
      const speeds: number[] = route.legs?.[0]?.annotation?.speed ?? [];
      const dists: number[] = route.legs?.[0]?.annotation?.distance ?? [];
      let hwDist = 0, totDist = 0;
      speeds.forEach((s, i) => {
        const d = dists[i] ?? 0;
        totDist += d;
        if (s >= HIGHWAY_MS) hwDist += d;
      });
      const highway_fraction = totDist > 0 ? hwDist / totDist : 0.45;

      // Elevation gain from GeoJSON geometry: coords are [lon, lat, alt_m]
      const pts: number[][] = route.geometry.coordinates ?? [];
      let elevation_gain_m = 0;
      for (let i = 1; i < pts.length; i++) {
        const delta = (pts[i][2] ?? 0) - (pts[i - 1][2] ?? 0);
        if (delta > 0) elevation_gain_m += delta;
      }

      const elevFt = Math.round(elevation_gain_m * 3.281);
      const summary = `${distance_mi.toFixed(1)} mi · ${Math.round(highway_fraction * 100)}% highway · ${elevFt} ft climbing`;

      const r: RouteData = { distance_mi, highway_fraction, elevation_gain_m, summary };
      setResult(r);
      onFill(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Route lookup failed.");
    } finally {
      setLoading(false);
    }
  }, [homeCoords, workCoords, token, onFill]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 text-xs text-brand hover:underline text-left"
      >
        or calculate from your commute route →
      </button>
    );
  }

  return (
    <div className="col-span-full rounded-xl bg-sky-50 ring-1 ring-sky-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-sky-900">
          Calculate from your commute
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-sky-600 hover:underline px-2 py-1 -mr-1"
        >
          close
        </button>
      </div>

      <AddressField
        label="Home address"
        value={homeText}
        suggestions={homeSugg}
        onChange={onHomeChange}
        onSelect={selectHome}
      />
      <AddressField
        label="Work address"
        value={workText}
        suggestions={workSugg}
        onChange={onWorkChange}
        onSelect={selectWork}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={getRoute}
          disabled={!homeCoords || !workCoords || loading}
          className="rounded-lg bg-brand px-4 py-3 text-sm font-medium text-white disabled:opacity-40 hover:opacity-90 transition"
        >
          {loading ? "Looking up route…" : "Get route"}
        </button>
        {result && (
          <span className="text-sm font-medium text-sky-900">{result.summary}</span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <p className="text-xs text-sky-700">
        Addresses are sent directly to Mapbox and are not stored by GoEV WV.
      </p>
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
      <label className="block text-xs font-medium text-sky-800 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Start typing an address…"
        autoComplete="off"
        className="w-full rounded-lg border border-sky-300 px-3 py-3 text-sm text-ink shadow-sm focus:border-brand focus:outline-none bg-white"
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={() => onSelect(s)}
                className="w-full px-3 py-3 text-left text-sm text-ink hover:bg-sky-50 truncate"
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
