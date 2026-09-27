"use client";

// Range + luggage explorer for /ev. One row per vehicle: how far it goes on a
// cold WV day (solid bar), at a steady 70 mph in mild weather (tick), and the
// EPA rating (faint outline) — plus luggage room with every seat full. The two
// range numbers are different conditions; we never invent a "cold + highway"
// figure.

import Link from "next/link";
import { useMemo, useState } from "react";
import { CHART_COLORS } from "@/components/charts";
import { Term } from "@/components/Term";

export interface ExplorerRow {
  id: string;
  name: string;
  cls: string;
  price: number;
  powertrain: "bev" | "phev";
  winter: number | null;   // BEV cold-day range, or PHEV electric range
  hwy: number | null;
  epa: number | null;
  cargo: number | null;    // cu ft, every seat full (incl. frunk/sub-trunk)
  bedFt: number | null;
  status: string;
}

const RANGE_MAX = 450;
const CARGO_MAX = 60;
const LUGGAGE_TICKS = [
  { v: 8, label: "light" },
  { v: 20, label: "normal" },
  { v: 28, label: "packed" },
  { v: 40, label: "loaded" },
];
const CLASSES = [
  { v: "all", label: "All" },
  { v: "suv", label: "SUVs" },
  { v: "truck", label: "Pickups" },
  { v: "sedan", label: "Cars" },
  { v: "van", label: "Vans" },
];
const SORTS = [
  { v: "winter", label: "Cold-day range" },
  { v: "hwy", label: "Highway range" },
  { v: "cargo", label: "Luggage room" },
  { v: "price", label: "Price" },
] as const;

const pct = (v: number, max: number) => `${Math.min(100, (v / max) * 100)}%`;

export function RangeCargoExplorer({ rows }: { rows: ExplorerRow[] }) {
  const [cls, setCls] = useState("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]["v"]>("winter");
  const [usedToo, setUsedToo] = useState(false);

  const shown = useMemo(() => {
    const list = rows.filter((r) =>
      (usedToo || r.status !== "discontinued") &&
      (cls === "all" || r.cls === cls || (cls === "sedan" && r.cls === "hatchback")),
    );
    const key = (r: ExplorerRow) =>
      sort === "price" ? -r.price : sort === "cargo" ? (r.bedFt ? 999 : r.cargo ?? -1) : sort === "hwy" ? r.hwy ?? -1 : r.winter ?? -1;
    return [...list].sort((a, b) => key(b) - key(a));
  }, [rows, cls, sort, usedToo]);

  return (
    <section aria-labelledby="explorer-title" className="mt-8 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4 sm:p-6">
      <h2 id="explorer-title" className="text-xl font-bold text-ink">How far, and how much fits?</h2>
      <p className="mt-1 text-sm text-ink-muted">
        <span className="inline-block h-2.5 w-5 rounded-sm align-middle" style={{ background: CHART_COLORS.ev }} /> cold WV day (mixed driving){" "}
        · <span className="inline-block h-3 w-0.5 align-middle bg-ink" /> steady 70 mph, mild weather{" "}
        · <span className="inline-block h-2.5 w-5 rounded-sm align-middle border border-slate-400" /> <Term id="range">EPA rating</Term>.
        Plug-in hybrids show electric miles only. Luggage room is with every seat full, including any front trunk.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {CLASSES.map((c) => (
          <button key={c.v} type="button" onClick={() => setCls(c.v)} aria-pressed={cls === c.v}
            className={`min-h-9 rounded-full border px-3 text-sm ${cls === c.v ? "border-brand bg-brand-bg text-emerald-900 font-semibold" : "border-slate-300 bg-white text-ink-muted"}`}>
            {c.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-sm text-ink-muted">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </label>
      </div>
      <label className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
        <input type="checkbox" checked={usedToo} onChange={(e) => setUsedToo(e.target.checked)} className="h-4 w-4 accent-emerald-700" />
        Include models only sold used
      </label>

      <ul className="mt-4 divide-y divide-slate-100">
        {shown.map((r) => (
          <li key={r.id}>
            <Link href={`/ev/${r.id}`} className="block py-3 hover:bg-slate-50 rounded-lg -mx-2 px-2"
              aria-label={`${r.name}, $${r.price.toLocaleString("en-US")}. ${r.winter ? `${r.winter} miles on a cold day` : ""}${r.hwy ? `, ${r.hwy} at 70 mph` : ""}. ${r.bedFt ? `${r.bedFt} foot bed` : r.cargo != null ? `${Math.round(r.cargo)} cubic feet of luggage room` : "luggage room unknown"}.`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-ink text-sm">{r.name}</span>
                <span className="text-xs text-ink-soft whitespace-nowrap">${Math.round(r.price / 1000)}k{r.status === "discontinued" ? " · used" : ""}</span>
              </div>
              <div className="mt-1.5 grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1">
                <div className="chart relative h-3">
                  {r.epa != null && <div className="absolute inset-y-0 left-0 rounded-sm border border-slate-300" style={{ width: pct(r.epa, RANGE_MAX) }} />}
                  {r.winter != null && (
                    <div className="absolute inset-y-0 left-0 rounded-sm motion-safe:transition-[width] motion-safe:duration-500"
                      style={{ width: pct(r.winter, RANGE_MAX), background: r.powertrain === "phev" ? CHART_COLORS.phev : CHART_COLORS.ev }} />
                  )}
                  {r.hwy != null && <div className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-ink" style={{ left: pct(r.hwy, RANGE_MAX) }} />}
                </div>
                <span className="text-xs text-ink tabular-nums w-28 text-right">
                  {r.powertrain === "phev" ? `${r.winter ?? "?"} mi electric` : `${r.winter ?? "?"} cold · ${r.hwy ?? "?"} hwy`}
                </span>
                <div className="chart relative h-2">
                  {r.bedFt ? (
                    <span className="absolute -top-1 left-0 rounded-full bg-slate-200 px-2 text-[11px] text-ink">{r.bedFt} ft bed</span>
                  ) : r.cargo != null ? (
                    <>
                      <div className="absolute inset-0 rounded-full bg-slate-100" />
                      <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(r.cargo, CARGO_MAX), background: CHART_COLORS.gas }} />
                      {LUGGAGE_TICKS.map((t) => (
                        <div key={t.v} className="absolute -top-0.5 -bottom-0.5 w-px bg-white" style={{ left: pct(t.v, CARGO_MAX) }} />
                      ))}
                    </>
                  ) : (
                    <span className="absolute -top-1 left-0 text-[11px] text-ink-soft">luggage room not published</span>
                  )}
                </div>
                <span className="text-xs text-ink-muted tabular-nums w-28 text-right">
                  {r.bedFt ? "pickup bed" : r.cargo != null ? `${Math.round(r.cargo)} cu ft${r.cargo > CARGO_MAX ? " →" : ""}` : "—"}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-soft">
        Scale: range 0–{RANGE_MAX} mi; luggage 0–{CARGO_MAX} cu ft, with marks at light / normal / packed / loaded
        ({LUGGAGE_TICKS.map((t) => t.v).join(" / ")} cu ft) — the same luggage levels the household planner uses.
      </p>
    </section>
  );
}
