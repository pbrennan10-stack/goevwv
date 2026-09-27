"use client";

// Household planner: plan the whole driveway, not one car. Four steps —
// vehicles you own, how the household drives, which EV to try, and the
// plan (whole-household cost over an ownership period, who drives what,
// and whether each trip fits). Math lives in lib/household.ts.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cargoSeatsUpLabel } from "@/lib/capability";
import {
  fit,
  planHousehold,
  retention,
  usedBreakEvenPrice,
  type Catalog,
  type HouseholdInput,
  type TripInput,
  type Unit,
} from "@/lib/household";
import type { IceVehicle, Vehicle } from "@/lib/types";

interface Props {
  catalog: Catalog;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

// ---------- Presets ----------

const LUGGAGE = [
  { v: 8, label: "Light — a couple of bags" },
  { v: 20, label: "Normal — a suitcase each" },
  { v: 28, label: "Packed — suitcases + beach/camping gear" },
  { v: 40, label: "Loaded — gear for a week away" },
];

interface TripPreset extends TripInput { on: boolean }

const TRIP_PRESETS: TripPreset[] = [
  { id: "beach", label: "Beach vacation", oneWayMi: 400, perYear: 1, people: 4, luggageCuFt: 28, towLbs: 0, on: true },
  { id: "family", label: "Visit family", oneWayMi: 220, perYear: 6, people: 2, luggageCuFt: 8, towLbs: 0, on: true },
  { id: "ski", label: "Ski or lake weekend", oneWayMi: 150, perYear: 3, people: 4, luggageCuFt: 20, towLbs: 0, on: false },
  { id: "camp", label: "Hunting or fishing camp", oneWayMi: 90, perYear: 4, people: 2, luggageCuFt: 20, towLbs: 0, on: false },
  { id: "tow", label: "Tow a camper or boat", oneWayMi: 60, perYear: 3, people: 4, luggageCuFt: 8, towLbs: 5000, on: false },
];

interface State {
  step: number;
  owned: { key: string; ref: string; valueNow: number; mpgOverride?: number }[];
  candRef: string;
  priceOverride: number | null;
  replaces: string | null;
  drivers: { id: number; commuteOneWayMi: number; daysPerWeek: number }[];
  errandsMiPerWeek: number;
  errandsPeople: number;
  trips: TripPreset[];
  utilityId: string;
  useTOU: boolean;
  gasPrice: number;
  years: number;
  overrides: Record<string, string>;
  retention5yOverride: number | null;
  // New gas vehicle to compare against: "auto" = new version of the vehicle
  // being replaced (when it's still sold), null = no comparison.
  gasRef: string | null;
  gasPriceOverride: number | null;
}

function initialState(cat: Catalog): State {
  return {
    step: 0,
    owned: [{ key: "a", ref: "ice:honda-crv-2024", valueNow: cat.own.default_owned_value_usd }],
    candRef: "ev:chevy-equinox-ev-2025",
    priceOverride: null,
    replaces: "a",
    drivers: [{ id: 1, commuteOneWayMi: 21, daysPerWeek: 5 }],
    errandsMiPerWeek: 60,
    errandsPeople: 3,
    trips: TRIP_PRESETS.map((t) => ({ ...t })),
    utilityId: "aep",
    useTOU: false,
    gasPrice: cat.fed.calculation_notes.gas_price_baseline_per_gal.current,
    years: cat.own.ownership_years_default,
    overrides: {},
    retention5yOverride: null,
    gasRef: "auto",
    gasPriceOverride: null,
  };
}

// State lives in the URL (?h=…) so a plan can be shared or bookmarked.
function encodeState(s: State): string {
  const json = JSON.stringify({ ...s, step: undefined });
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeState(q: string): Partial<State> | null {
  try {
    const b = q.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(escape(atob(b))));
  } catch {
    return null;
  }
}

// ---------- Small UI pieces ----------

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-4 sm:p-5 ${className}`}>{children}</div>;
}

function Num({
  label, value, onChange, min = 0, max = 100000, step = 1, suffix, prefix,
}: {
  label: string; value: number; onChange: (n: number) => void;
  min?: number; max?: number; step?: number; suffix?: string; prefix?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-sm font-medium text-ink">{label}</span>
      <span className="flex items-center rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-brand">
        {prefix && <span className="pl-3 text-ink-soft">{prefix}</span>}
        <input
          type="number" inputMode="decimal" min={min} max={max} step={step} value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== "" && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          onBlur={() => setDraft(String(value))}
          className="w-full min-w-0 rounded-lg px-3 py-2.5 text-ink outline-none bg-transparent"
        />
        {suffix && <span className="pr-3 text-sm text-ink-soft whitespace-nowrap">{suffix}</span>}
      </span>
    </label>
  );
}

function VehicleSelect({
  label, value, onChange, evs, ice, includeGas,
}: {
  label: string; value: string; onChange: (v: string) => void;
  evs: Vehicle[]; ice: IceVehicle[]; includeGas: boolean;
}) {
  const evGroups = useMemo(() => {
    const order = ["suv", "truck", "sedan", "hatchback", "minivan", "van", "other"];
    const names: Record<string, string> = { suv: "SUVs", truck: "Pickups", sedan: "Sedans", hatchback: "Hatchbacks", minivan: "Minivans", van: "Cargo vans", other: "Other" };
    return order
      .map((c) => ({ c, name: names[c], list: evs.filter((v) => v.class === c).sort((a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`)) }))
      .filter((g) => g.list.length);
  }, [evs]);
  const iceSorted = useMemo(() => [...ice].sort((a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`)), [ice]);
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-sm font-medium text-ink">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-ink shadow-sm bg-white"
      >
        {includeGas && (
          <optgroup label="Gas & hybrid (pick the closest match)">
            {iceSorted.map((v) => (
              <option key={v.id} value={`ice:${v.id}`}>{v.make} {v.model} {v.trim}</option>
            ))}
          </optgroup>
        )}
        {evGroups.map((g) => (
          <optgroup key={g.c} label={`${includeGas ? "Electric & plug-in — " : ""}${g.name}`}>
            {g.list.map((v) => (
              <option key={v.id} value={`ev:${v.id}`}>
                {v.make} {v.model} {v.trim}{v.powertrain === "phev" ? " (plug-in hybrid)" : ""}{v.status === "discontinued" ? " — used only" : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="h-11 w-11 shrink-0 rounded-lg text-ink-soft hover:bg-slate-100 hover:text-ink flex items-center justify-center">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  );
}

function FitIcon({ level }: { level: "ok" | "tight" | "no" }) {
  const bg = level === "ok" ? "bg-emerald-700" : level === "tight" ? "bg-amber-600" : "bg-red-700";
  return (
    <span className={`mt-0.5 h-5 w-5 shrink-0 rounded-full ${bg} flex items-center justify-center`} aria-label={level === "ok" ? "Fits" : level === "tight" ? "Tight" : "Doesn't fit"}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {level === "ok" ? <path d="M5 12l5 5L20 7" /> : level === "tight" ? <path d="M12 7v6M12 17h.01" /> : <path d="M7 7l10 10M17 7L7 17" />}
      </svg>
    </span>
  );
}

// ---------- Main ----------

const STEPS = ["Vehicles", "Driving", "Try an EV", "Your plan"];

export function HouseholdPlanner({ catalog }: Props) {
  const [s, setS] = useState<State>(() => initialState(catalog));
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = (patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("h");
    const loaded = q ? decodeState(q) : null;
    if (loaded) setS((prev) => ({ ...prev, ...loaded, step: 3 }));
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const url = `${window.location.pathname}?h=${encodeState(s)}`;
    window.history.replaceState(null, "", url);
  }, [s, hydrated]);

  const cand = catalog.evs.find((v) => `ev:${v.id}` === s.candRef);
  const defaultPrice = cand ? cand.msrp_usd + (cand.destination_usd ?? 0) : 0;
  const price = s.priceOverride ?? defaultPrice;

  const buyableGas = catalog.ice.filter((v) => v.new_status === "current" && v.new_msrp_usd);
  const replacedRef = s.owned.find((o) => o.key === s.replaces)?.ref;
  const autoGas = replacedRef && buyableGas.some((v) => `ice:${v.id}` === replacedRef) ? replacedRef : null;
  const gasRef = s.gasRef === "auto" ? autoGas : s.gasRef;
  const gasVehicle = gasRef ? buyableGas.find((v) => `ice:${v.id}` === gasRef) : undefined;
  const gasDefaultPrice = gasVehicle ? (gasVehicle.new_msrp_usd ?? 0) + (gasVehicle.new_destination_usd ?? 0) : 0;
  const gasPrice = s.gasPriceOverride ?? gasDefaultPrice;

  const input: HouseholdInput = {
    owned: s.owned,
    candidate: cand ? { ref: s.candRef, price, replaces: s.replaces } : null,
    gasAlternative: gasVehicle ? { ref: `ice:${gasVehicle.id}`, price: gasPrice } : null,
    drivers: s.drivers,
    errandsMiPerWeek: s.errandsMiPerWeek,
    errandsPeople: s.errandsPeople,
    trips: s.trips.filter((t) => t.on),
    utilityId: s.utilityId,
    useTOU: s.useTOU,
    gasPrice: s.gasPrice,
    years: s.years,
    overrides: s.overrides,
    retention5yOverride: s.retention5yOverride,
  };
  const result = useMemo(() => planHousehold(input, catalog), [JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps

  const unitName = (ref: string) => {
    const [k, id] = ref.split(":");
    const v = k === "ev" ? catalog.evs.find((x) => x.id === id) : catalog.ice.find((x) => x.id === id);
    return v ? `${v.make} ${v.model}` : ref;
  };
  const go = (step: number) => { set({ step }); window.scrollTo({ top: 0 }); };
  const utility = catalog.utilities.find((u) => u.id === s.utilityId);
  const defaultRetention = cand
    ? retention(cand.powertrain === "phev" ? "phev" : "bev", cand.class, 5, catalog.own)
    : 0.43;

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <nav aria-label="Planner steps" className="grid grid-cols-4 gap-1.5">
        {STEPS.map((label, i) => (
          <button key={label} type="button" onClick={() => go(i)} aria-current={s.step === i ? "step" : undefined}
            className={`min-h-11 rounded-lg px-1 text-xs sm:text-sm font-semibold transition ${
              s.step === i ? "bg-brand-dark text-white" : i < s.step ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-ink-muted"
            }`}>
            <span className="hidden sm:inline">{i + 1}. </span>{label}
          </button>
        ))}
      </nav>

      {/* STEP 1 — VEHICLES */}
      {s.step === 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-ink">What&apos;s in your driveway?</h2>
            <p className="mt-1 text-ink-muted">Start with the vehicle you drive most. Most West Virginia households have two — add the other and we&apos;ll plan them together.</p>
          </div>
          {s.owned.map((o, i) => {
            const isGas = o.ref.startsWith("ice:");
            const u = catalog.ice.find((x) => `ice:${x.id}` === o.ref);
            return (
              <Card key={o.key} className="space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <VehicleSelect label={`Vehicle ${i + 1}`} value={o.ref} evs={catalog.evs} ice={catalog.ice} includeGas
                      onChange={(ref) => set({ owned: s.owned.map((x) => (x.key === o.key ? { ...x, ref, mpgOverride: undefined } : x)), overrides: {} })} />
                  </div>
                  {s.owned.length > 1 && (
                    <RemoveButton label={`Remove vehicle ${i + 1}`} onClick={() => {
                      const owned = s.owned.filter((x) => x.key !== o.key);
                      set({ owned, replaces: s.replaces === o.key ? owned[0]?.key ?? null : s.replaces, overrides: {} });
                    }} />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Num label="Worth today (roughly)" prefix="$" step={500} max={200000} value={o.valueNow}
                    onChange={(n) => set({ owned: s.owned.map((x) => (x.key === o.key ? { ...x, valueNow: n } : x)) })} />
                  {isGas && (
                    <Num label="Your real mpg" suffix="mpg" step={1} min={5} max={80} value={o.mpgOverride ?? u?.mpg_combined ?? 25}
                      onChange={(n) => set({ owned: s.owned.map((x) => (x.key === o.key ? { ...x, mpgOverride: n } : x)) })} />
                  )}
                </div>
              </Card>
            );
          })}
          {s.owned.length < 3 && (
            <button type="button"
              onClick={() => {
                const key = String.fromCharCode(97 + Math.max(...s.owned.map((o) => o.key.charCodeAt(0) - 96), 0));
                set({ owned: [...s.owned, { key, ref: "ice:chevy-silverado-2024", valueNow: catalog.own.default_owned_value_usd }], overrides: {} });
              }}
              className="w-full min-h-12 rounded-2xl border-2 border-dashed border-slate-300 text-brand-dark font-semibold hover:border-brand">
              + Add another vehicle you own
            </button>
          )}
          <p className="text-sm text-ink-soft">
            Not sure what it&apos;s worth? Kelley Blue Book or a dealer trade-in quote will tell you. It matters: selling a car you own is part of the math.
          </p>
        </section>
      )}

      {/* STEP 2 — DRIVING */}
      {s.step === 1 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-ink">How does your household drive?</h2>
            <p className="mt-1 text-ink-muted">Everyone drives differently — include people who don&apos;t commute.</p>
          </div>
          {s.drivers.map((d, i) => (
            <Card key={d.id} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-ink">Driver {i + 1}</h3>
                {s.drivers.length > 1 && (
                  <RemoveButton label={`Remove driver ${i + 1}`} onClick={() => set({ drivers: s.drivers.filter((x) => x.id !== d.id), overrides: {} })} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Num label="Commute, one way" suffix="mi" max={200} value={d.commuteOneWayMi}
                  onChange={(n) => set({ drivers: s.drivers.map((x) => (x.id === d.id ? { ...x, commuteOneWayMi: n } : x)) })} />
                <Num label="Days a week" max={7} value={d.daysPerWeek}
                  onChange={(n) => set({ drivers: s.drivers.map((x) => (x.id === d.id ? { ...x, daysPerWeek: n } : x)) })} />
              </div>
              {d.commuteOneWayMi === 0 && <p className="text-sm text-ink-soft">No commute — retired, remote, or at home.</p>}
            </Card>
          ))}
          {s.drivers.length < 4 && (
            <button type="button"
              onClick={() => set({ drivers: [...s.drivers, { id: Math.max(0, ...s.drivers.map((d) => d.id)) + 1, commuteOneWayMi: 0, daysPerWeek: 0 }] })}
              className="w-full min-h-12 rounded-2xl border-2 border-dashed border-slate-300 text-brand-dark font-semibold hover:border-brand">
              + Add a driver
            </button>
          )}
          <Card className="grid grid-cols-2 gap-3">
            <Num label="Errands & school runs" suffix="mi / week" max={1000} value={s.errandsMiPerWeek} onChange={(n) => set({ errandsMiPerWeek: n })} />
            <Num label="Usually how many people" min={1} max={8} value={s.errandsPeople} onChange={(n) => set({ errandsPeople: n })} />
          </Card>

          <div className="pt-2">
            <h3 className="text-xl font-bold text-ink">Trips you take</h3>
            <p className="mt-1 text-ink-muted">These decide which vehicle you actually need. Turn on the ones you do and adjust them.</p>
          </div>
          {s.trips.map((t) => (
            <Card key={t.id} className={t.on ? "ring-2 ring-brand" : ""}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={t.on} className="h-5 w-5 accent-emerald-700"
                  onChange={(e) => set({ trips: s.trips.map((x) => (x.id === t.id ? { ...x, on: e.target.checked } : x)), overrides: {} })} />
                <span className="font-semibold text-ink">{t.label}</span>
              </label>
              {t.on && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Num label="One way" suffix="mi" max={3000} value={t.oneWayMi}
                    onChange={(n) => set({ trips: s.trips.map((x) => (x.id === t.id ? { ...x, oneWayMi: n } : x)) })} />
                  <Num label="Times a year" max={100} value={t.perYear}
                    onChange={(n) => set({ trips: s.trips.map((x) => (x.id === t.id ? { ...x, perYear: n } : x)) })} />
                  <Num label="People" min={1} max={8} value={t.people}
                    onChange={(n) => set({ trips: s.trips.map((x) => (x.id === t.id ? { ...x, people: n } : x)) })} />
                  <Num label="Towing" suffix="lb" step={500} max={20000} value={t.towLbs}
                    onChange={(n) => set({ trips: s.trips.map((x) => (x.id === t.id ? { ...x, towLbs: n } : x)) })} />
                  <label className="col-span-2 sm:col-span-4 flex flex-col gap-1">
                    <span className="text-sm font-medium text-ink">Luggage</span>
                    <select value={t.luggageCuFt}
                      onChange={(e) => set({ trips: s.trips.map((x) => (x.id === t.id ? { ...x, luggageCuFt: Number(e.target.value) } : x)) })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 bg-white">
                      {LUGGAGE.map((l) => <option key={l.v} value={l.v}>{l.label} (~{l.v} cu ft)</option>)}
                    </select>
                  </label>
                </div>
              )}
            </Card>
          ))}
          <Card className="grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink">Your electric utility</span>
              <select value={s.utilityId} onChange={(e) => set({ utilityId: e.target.value, useTOU: false })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 bg-white">
                {catalog.utilities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <Num label="Gas price" prefix="$" suffix="/ gal" step={0.05} min={1} max={10} value={s.gasPrice} onChange={(n) => set({ gasPrice: n })} />
            {utility?.residential.tou_available && (
              <label className="sm:col-span-2 flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input type="checkbox" checked={s.useTOU} onChange={(e) => set({ useTOU: e.target.checked })} className="h-5 w-5 accent-emerald-700" />
                Charge on {utility.name}&apos;s off-peak EV rate (overnight &amp; weekends)
              </label>
            )}
          </Card>
        </section>
      )}

      {/* STEP 3 — TRY AN EV */}
      {s.step === 2 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-ink">Which one would you try?</h2>
            <p className="mt-1 text-ink-muted">Pick an electric or plug-in hybrid vehicle. You can switch any time — results update instantly.</p>
          </div>
          <Card className="space-y-3">
            <VehicleSelect label="Vehicle to try" value={s.candRef} evs={catalog.evs.filter((v) => v.status !== "discontinued")} ice={[]} includeGas={false}
              onChange={(ref) => set({ candRef: ref, priceOverride: null, overrides: {} })} />
            {cand && (
              <p className="text-sm text-ink-muted">
                {cand.powertrain === "phev" ? `Plug-in hybrid · ${cand.epa_range_mi_electric} mi electric` : `Electric · ~${cand.winter_range_mi} mi on a cold day, ~${cand.highway_range_mi} mi at highway speed`}
                {" · "}Seats {cand.seats}
                {cargoSeatsUpLabel(cand) ? ` · ${cargoSeatsUpLabel(cand)}` : ""}
                {cand.towing_lbs ? ` · tows ${cand.towing_lbs.toLocaleString("en-US")} lb` : cand.towing_lbs === 0 ? " · not rated to tow" : ""}
                {" · "}<Link href={`/ev/${cand.id}`} className="text-brand hover:underline">details</Link>
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Num label="Price you'd pay" prefix="$" step={250} max={300000} value={price} onChange={(n) => set({ priceOverride: n })} />
              <Num label="Years you'd keep it" suffix="years" min={1} max={15} value={s.years} onChange={(n) => set({ years: Math.round(n) || 1 })} />
            </div>
            <p className="text-xs text-ink-soft">
              Starts at MSRP{defaultPrice !== cand?.msrp_usd ? " + destination" : ""}. Enter a real quote if you have one. WV sales tax (6%, after trade-in) and title are added for you.
            </p>
          </Card>

          <h3 className="text-xl font-bold text-ink pt-2">And your current vehicles?</h3>
          <div className="space-y-2">
            {[...s.owned.map((o) => ({ id: o.key as string | null, label: `Replace the ${unitName(o.ref)}`, detail: `Sell or trade it in (worth ~${usd(o.valueNow)}); the new one takes over its driving` })),
              { id: null, label: "Keep them all", detail: "Add it as another vehicle" }].map((p) => (
              <button key={String(p.id)} type="button" onClick={() => set({ replaces: p.id, overrides: {} })} aria-pressed={s.replaces === p.id}
                className={`w-full text-left rounded-2xl p-4 border-2 transition ${s.replaces === p.id ? "border-brand bg-brand-bg" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                <span className="block font-semibold text-ink">{p.label}</span>
                <span className="block text-sm text-ink-muted">{p.detail}</span>
              </button>
            ))}
          </div>

          <h3 className="text-xl font-bold text-ink pt-2">Compare with a new gas vehicle</h3>
          <p className="text-ink-muted -mt-2">
            If it&apos;s time to replace a vehicle anyway, the real question is new EV <em>vs.</em> new gas — not vs. keeping what you have.
          </p>
          <Card className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink">New gas vehicle to compare</span>
              <select value={gasRef ?? ""}
                onChange={(e) => set({ gasRef: e.target.value || null, gasPriceOverride: null })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 bg-white">
                <option value="">No comparison</option>
                {[...buyableGas].sort((a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`)).map((v) => (
                  <option key={v.id} value={`ice:${v.id}`}>
                    {v.new_model_year ?? ""} {v.make} {v.model} {trimWithoutModel(v.new_trim ?? v.trim, v.model)} — {usd((v.new_msrp_usd ?? 0) + (v.new_destination_usd ?? 0))}
                  </option>
                ))}
              </select>
            </label>
            {gasVehicle && (
              <div className="grid grid-cols-2 gap-3">
                <Num label="Price you'd pay" prefix="$" step={250} max={300000} value={gasPrice} onChange={(n) => set({ gasPriceOverride: n })} />
                <div className="text-sm text-ink-muted self-end pb-2">
                  {gasVehicle.new_mpg_combined ?? gasVehicle.mpg_combined} mpg (EPA){gasVehicle.price_confidence === "approximate" ? " · price approximate" : ""}
                </div>
              </div>
            )}
            {s.gasRef === "auto" && !autoGas && replacedRef && (
              <p className="text-sm text-ink-soft">The vehicle you&apos;re replacing isn&apos;t in our new-vehicle price list — pick a comparable one above.</p>
            )}
          </Card>
        </section>
      )}

      {/* STEP 4 — YOUR PLAN */}
      {s.step === 3 && (
        <PlanResults s={s} set={set} result={result} catalog={catalog} price={price} cand={cand} gasVehicle={gasVehicle} input={input}
          defaultRetention={defaultRetention}
          copied={copied}
          onShare={async () => {
            const url = window.location.href;
            if (navigator.share) { try { await navigator.share({ title: "Our household EV plan", url }); } catch { /* closed */ } return; }
            try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { window.prompt("Copy this link:", url); }
          }} />
      )}

      {/* Nav */}
      <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-surface-raised/95 backdrop-blur flex gap-3 border-t border-slate-200 sm:border-0">
        {s.step > 0 && (
          <button type="button" onClick={() => go(s.step - 1)} className="min-h-12 px-5 rounded-xl border border-slate-300 bg-white font-semibold text-ink">Back</button>
        )}
        {s.step < 3 ? (
          <button type="button" onClick={() => go(s.step + 1)} className="flex-1 min-h-12 rounded-xl bg-brand-dark hover:bg-brand text-white font-bold">
            {s.step === 2 ? "See your plan" : "Next"}
          </button>
        ) : (
          <button type="button" onClick={() => go(0)} className="flex-1 min-h-12 rounded-xl bg-white border border-slate-300 font-semibold text-ink">Edit your household</button>
        )}
      </div>
    </div>
  );
}

// ---------- Results ----------

function PlanResults({
  s, set, result, catalog, price, cand, gasVehicle, input, defaultRetention, onShare, copied,
}: {
  gasVehicle: IceVehicle | undefined;
  input: HouseholdInput;
  s: State;
  set: (p: Partial<State>) => void;
  result: ReturnType<typeof planHousehold>;
  catalog: Catalog;
  price: number;
  cand: Vehicle | undefined;
  defaultRetention: number;
  onShare: () => void;
  copied: boolean;
}) {
  const { today, plan, uses, planUnits, gasAlt } = result;
  if (!plan || !cand) return <p className="text-ink-muted">Pick a vehicle to try in step 3.</p>;
  const diff = today.totalOverPeriod - plan.totalOverPeriod;
  const runDiff = today.runningPerYear - plan.runningPerYear;
  const Y = s.years;
  const retain = s.retention5yOverride ?? defaultRetention;

  const moveUse = (useId: string, fromKey: string) => {
    const use = uses.find((u) => u.id === useId)!;
    const capable = planUnits.filter((u) => fit(u, use).level !== "no");
    if (capable.length < 2) return;
    const i = capable.findIndex((u) => u.key === fromKey);
    const next = capable[(i + 1) % capable.length];
    set({ overrides: { ...s.overrides, [useId]: next.key } });
  };

  // Columns: today, the EV plan, and (optionally) a new gas vehicle instead.
  const cols = [
    { label: "Keep what you have", short: "Today", r: today },
    { label: `New ${cand.model}`, short: cand.model, r: plan },
    ...(gasAlt && gasVehicle ? [{ label: `New ${gasVehicle.model}`, short: gasVehicle.model, r: gasAlt }] : []),
  ];
  const rows: [string, (r: typeof today) => number][] = [
    ["Gas & charging", (r) => sum(r.units.map((u) => u.energy))],
    ["Maintenance", (r) => sum(r.units.map((u) => u.maintenance))],
    ["Insurance (estimate)", (r) => sum(r.units.map((u) => u.insurance))],
    ["WV registration & EV fees", (r) => sum(r.units.map((u) => u.registration))],
  ];
  const vsGas = gasAlt ? gasAlt.totalOverPeriod - plan.totalOverPeriod : null;
  const runVsGas = gasAlt ? gasAlt.runningPerYear - plan.runningPerYear : null;
  // Years until the EV's running-cost savings cover its extra up-front cost.
  const priceGap = gasAlt ? plan.upfrontCash - gasAlt.upfrontCash : null;
  const breakEvenYears =
    priceGap != null && runVsGas != null && runVsGas > 0 && priceGap > 0 ? priceGap / runVsGas : null;
  // What a USED one of the same model would need to cost to tie each option.
  const usedVsGas = gasAlt && gasVehicle ? usedBreakEvenPrice(plan, gasAlt.totalOverPeriod, input, catalog) : null;
  const usedVsToday = usedBreakEvenPrice(plan, today.totalOverPeriod, input, catalog);
  const usedTargets = [
    ...(gasAlt && gasVehicle ? [{ label: `beat a new ${gasVehicle.model}`, p: usedVsGas }] : []),
    { label: "beat keeping what you have", p: usedVsToday },
  ];

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-2xl font-bold text-ink">Your household plan</h2>
        <button type="button" onClick={onShare} className="shrink-0 min-h-11 px-3 text-sm font-semibold text-brand-dark hover:underline">
          {copied ? "Link copied ✓" : "Share plan"}
        </button>
      </div>

      <Card className="bg-brand-bg ring-emerald-200 space-y-3">
        <p className="text-sm text-ink-muted">Whole-household cost over {Y} years — buying, owning, and driving everything in your driveway.</p>
        <div className={`grid gap-3 ${cols.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {cols.map((c) => (
            <div key={c.label} className="min-w-0">
              <div className="text-xs text-ink-soft">{c.label}</div>
              <div className={`${cols.length === 3 ? "text-lg sm:text-2xl" : "text-2xl"} font-extrabold text-ink`}>{usd(c.r.totalOverPeriod)}</div>
              <div className="text-xs text-ink-soft break-words">{c.r.units.map((u) => u.unit.short).join(" + ")}</div>
            </div>
          ))}
        </div>
        {vsGas != null && runVsGas != null && gasVehicle && (
          <p className={`text-lg font-bold ${vsGas >= 0 ? "text-emerald-800" : "text-amber-800"}`}>
            vs. a new {gasVehicle.model}: the {cand.model}{" "}
            {vsGas >= 0 ? `saves about ${usd(vsGas)}` : `costs about ${usd(-vsGas)} more`} over {Y} years
            <span className="block text-sm font-medium text-ink-muted">
              Running costs are {usd(Math.abs(runVsGas))} a year {runVsGas >= 0 ? "lower" : "higher"}
              {priceGap != null && priceGap > 0 ? `; it costs ${usd(priceGap)} more up front` : priceGap != null && priceGap < 0 ? `, and it costs ${usd(-priceGap)} less up front` : ""}
              {breakEvenYears != null ? ` — the savings cover that in about ${breakEvenYears < 1 ? "a year" : `${Math.round(breakEvenYears * 10) / 10} years`}` : ""}.
              {" "}Totals include each vehicle&apos;s expected resale value.
            </span>
          </p>
        )}
        <p className={`${vsGas != null ? "text-base" : "text-lg"} font-bold ${diff >= 0 ? "text-emerald-800" : "text-amber-800"}`}>
          {vsGas != null ? "vs. keeping what you have: " : ""}
          {diff >= 0 ? `saves about ${usd(diff)} over ${Y} years` : `costs about ${usd(-diff)} more over ${Y} years`}
          <span className="block text-sm font-medium text-ink-muted">
            Running costs {runDiff >= 0 ? `drop ${usd(runDiff)}` : `rise ${usd(-runDiff)}`} a year; the rest is the price of the vehicle, minus what it&apos;s worth when you&apos;re done.
          </span>
        </p>
        {plan.unassigned.length > 0 && (
          <p className="rounded-lg bg-red-50 ring-1 ring-red-200 p-2 text-sm text-red-900">
            This plan&apos;s total leaves out {plan.unassigned.map((u) => u.label.toLowerCase()).join(" and ")} — no vehicle in it can do {plan.unassigned.length > 1 ? "them" : "it"}. It isn&apos;t a real option as-is.
          </p>
        )}
        <p className="text-sm text-ink">
          <strong>Cash up front:</strong> {usd(plan.upfrontCash)}{s.replaces ? " after your trade-in" : ""} (price + WV 6% sales tax + title).
        </p>
      </Card>

      {/* Used break-even */}
      <Card className="space-y-2">
        <h3 className="font-bold text-ink">Buying a used {cand.model} instead?</h3>
        <p className="text-sm text-ink-muted">
          We don&apos;t track used prices — they vary too much by year, miles, and battery health. Instead, here&apos;s
          what a used one would need to cost to come out ahead over {Y} years:
        </p>
        <ul className="space-y-1.5">
          {usedTargets.map((t) => (
            <li key={t.label} className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-1.5">
              <span className="text-sm text-ink">To {t.label}</span>
              <span className="font-bold text-ink whitespace-nowrap">
                {t.p == null
                  ? "not possible"
                  : t.p >= price * 0.95
                    ? "any fair used price"
                    : `${usd(Math.floor(t.p / 500) * 500)} or less`}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-soft">
          New, it&apos;s {usd(price)}.
          {usedTargets.some((t) => t.p != null && t.p >= price * 0.95)
            ? " “Any fair used price” means the math works out anywhere below the new price — a used one skips the steep first-years drop in value."
            : ""}
          {usedVsGas != null && usedVsGas < price * 0.95 ? ` A used one priced ${Math.round((1 - usedVsGas / price) * 100)}%+ below new beats the new gas option.` : ""}
          {" "}Assumes the used one drives and charges like new, then loses about {Math.round(catalog.own.older_vehicle_annual_depreciation * 100)}% of its value a year
          (Kelley Blue Book), with WV sales tax after trade-in. Check the battery&apos;s health report before you buy — range fades
          slowly with age, and most EV batteries carry an 8-year/100,000-mile warranty.
        </p>
      </Card>

      {/* Breakdown */}
      <Card>
        <h3 className="font-bold text-ink mb-2">Where the money goes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-soft border-b border-slate-200">
                <th className="py-2 pr-3 font-medium">Per year</th>
                {cols.map((c) => <th key={c.label} className="py-2 pl-2 font-medium text-right">{c.short}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, get]) => (
                <tr key={label} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{label}</td>
                  {cols.map((c) => <td key={c.label} className="py-2 pl-2 text-right">{usd(get(c.r))}</td>)}
                </tr>
              ))}
              <tr className="border-b border-slate-200 font-semibold">
                <td className="py-2 pr-3">Running costs</td>
                {cols.map((c) => <td key={c.label} className="py-2 pl-2 text-right">{usd(c.r.runningPerYear)}</td>)}
              </tr>
              <tr>
                <td className="py-2 pr-3">Lost value over {Y} years<span className="block text-xs text-ink-soft">buying new, and what your cars lose as they age</span></td>
                {cols.map((c) => <td key={c.label} className="py-2 pl-2 text-right align-top">{usd(c.r.capitalOverPeriod)}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-ink-soft">
          {plan.units.map((u) => <li key={u.unit.key}><strong className="text-ink-muted">{u.unit.short}:</strong> {u.capitalNote}</li>)}
          {gasAlt?.units.filter((u) => u.unit.isNew).map((u) => (
            <li key="gas-new"><strong className="text-ink-muted">{u.unit.short} (new, instead):</strong> {u.capitalNote}</li>
          ))}
          {s.replaces && today.units.filter((u) => u.unit.key === s.replaces).map((u) => (
            <li key="sold"><strong className="text-ink-muted">{u.unit.short} (if kept):</strong> {u.capitalNote}</li>
          ))}
        </ul>
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-ink">
              {cand.model} keeps {Math.round(retain * 100)}% of its price after 5 years
            </span>
            <input type="range" min={25} max={75} step={1} value={Math.round(retain * 100)}
              onChange={(e) => set({ retention5yOverride: Number(e.target.value) / 100 })}
              className="accent-emerald-700" aria-label="Resale value after 5 years" />
            <span className="text-xs text-ink-soft">
              {s.retention5yOverride == null
                ? `Default ${Math.round(defaultRetention * 100)}% from iSeeCars' 2026 study of 5-year-old ${cand.powertrain === "phev" ? "vehicles" : "EVs"}. Used-EV prices firmed in 2026 as gas prices rose (Cox Automotive: up ~8% year over year this summer), so newer EVs may hold value better than early ones did. Slide to your own view.`
                : <>Your estimate. <button type="button" className="text-brand hover:underline" onClick={() => set({ retention5yOverride: null })}>Reset to {Math.round(defaultRetention * 100)}%</button></>}
            </span>
          </label>
          <Num label="Years you'd keep it" suffix="years" min={1} max={15} value={Y} onChange={(n) => set({ years: Math.round(n) || 1 })} />
        </div>
      </Card>

      {/* Who drives what */}
      <div>
        <h3 className="text-xl font-bold text-ink">Who drives what</h3>
        <p className="text-sm text-ink-muted">Each drive goes to the cheapest vehicle that can handle it. Tap one to move it.</p>
      </div>
      {plan.units.map((u) => (
        <Card key={u.unit.key} className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-ink">{u.unit.name}{u.unit.isNew ? " (new)" : ""}</span>
            <span className="text-sm text-ink-soft whitespace-nowrap">{Math.round(u.miles).toLocaleString("en-US")} mi/yr · {Math.round(u.share * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
            <div className={`h-full rounded-full ${u.unit.isNew ? "bg-brand" : "bg-slate-500"}`} style={{ width: `${Math.round(u.share * 100)}%` }} />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {u.uses.length === 0 && <span className="text-sm text-ink-soft">Nothing assigned — could this one go?</span>}
            {u.uses.map((use) => {
              const mine = !!s.overrides[use.id];
              return (
                <button key={use.id} type="button" onClick={() => moveUse(use.id, u.unit.key)}
                  className={`min-h-9 rounded-full px-3 text-sm font-medium border ${mine ? "bg-blue-50 text-blue-900 border-blue-300" : "bg-slate-50 text-ink border-slate-200"}`}>
                  {use.label}{mine ? " · your pick" : ""}
                </button>
              );
            })}
          </div>
        </Card>
      ))}
      {plan.unassigned.length > 0 && (
        <p className="rounded-lg bg-red-50 ring-1 ring-red-200 p-3 text-sm text-red-900">
          No vehicle in this plan can handle: {plan.unassigned.map((u) => u.label).join(", ")}. Keep a vehicle that can, or pick a different one to try.
        </p>
      )}

      {/* Trip fit */}
      {uses.some((u) => u.kind === "trip") && (
        <>
          <div>
            <h3 className="text-xl font-bold text-ink">Will it handle your trips?</h3>
          </div>
          {uses.filter((u) => u.kind === "trip").map((use) => (
            <Card key={use.id} className="space-y-2">
              <div>
                <span className="font-semibold text-ink">{use.label}</span>
                <span className="block text-sm text-ink-soft">
                  {use.oneWayMi} mi each way · {use.timesPerYear}× a year · {use.people} {use.people === 1 ? "person" : "people"}
                  {use.towLbs ? ` · towing ${use.towLbs.toLocaleString("en-US")} lb` : ""}
                </span>
              </div>
              {planUnits.map((u: Unit) => {
                const f = fit(u, use);
                const assigned = plan.assignment[use.id] === u.key;
                return (
                  <div key={u.key} className="flex gap-2">
                    <FitIcon level={f.level} />
                    <div className="text-sm">
                      <span className="font-medium text-ink">{u.short}</span>
                      {assigned && <span className="text-emerald-800 font-medium"> · taking this trip</span>}
                      <span className="block text-ink-muted">{f.text}</span>
                    </div>
                  </div>
                );
              })}
            </Card>
          ))}
          {cand.powertrain === "bev" && uses.some((u) => u.kind === "trip" && plan.assignment[u.id] === "new" && u.oneWayMi >= 250) && (
            <p className="rounded-xl bg-white ring-1 ring-slate-200 p-4 text-sm text-ink-muted">
              <strong className="text-ink">EV road trips work better than most people expect.</strong> Our family takes a Model Y to the beach every summer — four of us plus luggage, with charging stops that line up with the breaks we&apos;d take anyway.
            </p>
          )}
        </>
      )}

      <details className="rounded-2xl bg-surface-sunken ring-1 ring-slate-200 p-4 text-sm text-ink-muted">
        <summary className="cursor-pointer font-semibold text-ink">How this is calculated</summary>
        <ul className="mt-3 list-disc pl-5 space-y-1.5">
          <li>Everything is over {Y} years: running costs × {Y}, plus lost value — the new vehicle&apos;s price, WV sales tax (6% of price minus trade-in) and title, minus its estimated resale value; and for vehicles you keep, what they lose as they age (~{Math.round(catalog.own.older_vehicle_annual_depreciation * 100)}% a year, Kelley Blue Book).</li>
          <li>Selling a car you own isn&apos;t free money — it&apos;s value you&apos;d otherwise watch shrink. So &ldquo;today&rdquo; includes what your current cars lose over {Y} years.</li>
          <li>Charging uses your utility&apos;s marginal rate with WV winter losses; road-trip miles beyond the first charge use public fast chargers at ${catalog.fed.calculation_notes.dcfc_rate_per_kwh?.current.toFixed(2) ?? "0.55"}/kWh. Towing cuts EV range about 45%.</li>
          <li>Insurance is an estimate for a 35–45-year-old WV driver with a clean record; your quote will differ. Financing isn&apos;t included.</li>
          <li>Comparing a new EV with keeping an older car usually favors keeping the older car — new vehicles lose value fastest. That&apos;s why we also compare against buying a <em>new gas vehicle</em>: the fairer question when it&apos;s time to replace one. The gas vehicle uses its current EPA mpg, MSRP + destination, and all-vehicle resale value (trucks: truck resale value).</li>
        </ul>
        <p className="mt-3">Every source is on <Link href="/state-of-the-data" className="text-brand hover:underline">State of the Data</Link>.</p>
      </details>
    </section>
  );
}

// Some trim names repeat the model ("Q5 Premium" on an Audi Q5).
function trimWithoutModel(trim: string, model: string) {
  return trim.toLowerCase().startsWith(`${model.toLowerCase()} `) ? trim.slice(model.length + 1) : trim;
}

function sum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}
