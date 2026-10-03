// Shared shape of a household plan, its presets, and how it's encoded in a
// shareable URL (?h=…). Used by the planner (components/HouseholdPlanner.tsx).

import type { Catalog, FinancingInput, HomeCharging, OdometerBand, OwnershipAssumptions, TripInput, WorkCharging } from "./household";

// ---------- Presets ----------

export const LUGGAGE = [
  { v: 8, label: "Light — a couple of bags" },
  { v: 20, label: "Normal — a suitcase each" },
  { v: 28, label: "Packed — suitcases + beach/camping gear" },
  { v: 40, label: "Loaded — gear for a week away" },
];

export interface TripPreset extends TripInput { on: boolean }

export const TRIP_PRESETS: TripPreset[] = [
  { id: "beach", label: "Beach vacation", oneWayMi: 400, perYear: 1, people: 4, luggageCuFt: 28, towLbs: 0, on: true },
  { id: "family", label: "Visit family", oneWayMi: 220, perYear: 6, people: 2, luggageCuFt: 8, towLbs: 0, on: true },
  { id: "ski", label: "Ski or lake weekend", oneWayMi: 150, perYear: 3, people: 4, luggageCuFt: 20, towLbs: 0, on: false },
  { id: "camp", label: "Hunting or fishing camp", oneWayMi: 90, perYear: 4, people: 2, luggageCuFt: 20, towLbs: 0, on: false },
  { id: "tow", label: "Tow a camper or boat", oneWayMi: 60, perYear: 3, people: 4, luggageCuFt: 8, towLbs: 5000, on: false },
];

export interface PlanState {
  step: number;
  owned: { key: string; ref: string; valueNow: number; mpgOverride?: number; odometer?: OdometerBand }[];
  candRef: string;
  priceOverride: number | null;
  replaces: string | null;
  drivers: { id: number; commuteOneWayMi: number; daysPerWeek: number; workCharging?: WorkCharging; workCentsPerKwh?: number }[];
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
  homeCharging: HomeCharging;
  // Buying used instead of new (null = new). The price is the one you found —
  // null until you type it, because we never guess used prices.
  candUsed: UsedPick | null;
  gasUsed: UsedPick | null;
  // Paying monthly (null = cash). aprPct null = the sourced starting rates
  // (new / used); the same entered rate applies to the EV and the gas vehicle.
  finance: FinancePick | null;
}

export interface FinancePick {
  aprPct: number | null;
  months: number;
  down: number;
}

export const TERM_OPTIONS = [36, 48, 60, 72, 84];

export function defaultFinance(cat: Catalog): FinancePick {
  return { aprPct: null, months: cat.own.apr_reference?.term_months ?? 60, down: 0 };
}

// The engine's view of the choice: rates by new/used, or the one you entered.
export function financingFor(f: FinancePick | null, own: OwnershipAssumptions): FinancingInput | null {
  if (!f) return null;
  const apr = f.aprPct != null ? f.aprPct / 100 : null;
  return { aprNew: apr ?? own.apr_reference.new_60mo, aprUsed: apr ?? own.apr_reference.used, termMonths: f.months, cashDown: f.down };
}

export interface UsedPick {
  price: number | null;
  odometer: OdometerBand;
}

// A used vehicle is typically 2–4 years old, so the mileage starts low.
export const DEFAULT_USED_PICK: UsedPick = { price: null, odometer: "under_50k" };

export const ODOMETER_OPTIONS: { v: OdometerBand; label: string }[] = [
  { v: "under_50k", label: "Under 50,000" },
  { v: "50k_100k", label: "50,000–100,000" },
  { v: "over_100k", label: "Over 100,000" },
];

// Paid starts at the average WV business rate; the user can enter their
// employer's actual price.
export const WORK_CHARGING_OPTIONS: { v: WorkCharging; label: string }[] = [
  { v: "none", label: "No, or not sure" },
  { v: "free", label: "Yes — free" },
  { v: "paid", label: "Yes — I'd pay for it" },
];

// The default price for paid charging at work, in cents per kWh.
export function workDefaultCents(cat: Catalog): number {
  const c = cat.fed.calculation_notes.commercial_rate_per_kwh?.current;
  return Math.round((c ?? 0.1164) * 1000) / 10;
}

export const CHARGING_OPTIONS: { v: HomeCharging; label: string }[] = [
  { v: "auto", label: "Not sure — pick for me" },
  { v: "l1", label: "Regular wall outlet (no install)" },
  { v: "l2", label: "Install a Level 2 charger (240V)" },
  { v: "none", label: "I can't charge at home" },
];

export function gasOutlook(cat: Catalog) {
  const o = cat.fed.calculation_notes.gas_price_outlook_per_gal;
  const today = cat.fed.calculation_notes.gas_price_baseline_per_gal.current;
  return { mid: o?.mid ?? today, low: o?.low ?? today, high: o?.high ?? today, today };
}

export function initialState(cat: Catalog): PlanState {
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
    gasPrice: gasOutlook(cat).mid,
    years: cat.own.ownership_years_default,
    overrides: {},
    retention5yOverride: null,
    gasRef: "auto",
    gasPriceOverride: null,
    homeCharging: "auto",
    candUsed: null,
    gasUsed: null,
    finance: null,
  };
}

// State lives in the URL (?h=…) so a plan can be shared or bookmarked.
export function encodeState(s: Partial<PlanState>): string {
  // Preset trips the user hasn't edited are stored as just {id, on}.
  const trips = s.trips?.map((tr) => {
    const p = TRIP_PRESETS.find((x) => x.id === tr.id);
    const same = p && (["label", "oneWayMi", "perYear", "people", "luggageCuFt", "towLbs"] as const).every((k) => p[k] === tr[k]);
    return same ? { id: tr.id, on: tr.on } : tr;
  });
  const json = JSON.stringify({ ...s, trips, step: undefined });
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decodeState(q: string): Partial<PlanState> | null {
  try {
    const b = q.replace(/-/g, "+").replace(/_/g, "/");
    const raw = JSON.parse(decodeURIComponent(escape(atob(b))));
    if (raw && Array.isArray(raw.trips)) {
      raw.trips = raw.trips.map((tr: Partial<TripPreset>) => {
        const p = TRIP_PRESETS.find((x) => x.id === tr?.id);
        return p && tr.label === undefined ? { ...p, on: !!tr.on } : tr;
      });
    }
    return raw;
  } catch {
    return null;
  }
}

// Shared links come from anywhere — keep only well-formed fields that point at
// vehicles we still have, so an old or mangled link can't crash the page.
export function sanitizeLoaded(raw: Partial<PlanState> | null, cat: Catalog): Partial<PlanState> | null {
  if (!raw || typeof raw !== "object") return null;
  const refOk = (r: unknown) => {
    if (typeof r !== "string") return false;
    const [k, id] = r.split(":");
    return k === "ev" ? cat.evs.some((v) => v.id === id) : k === "ice" ? cat.ice.some((v) => v.id === id) : false;
  };
  const num = (x: unknown, lo: number, hi: number) => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;
  const out: Partial<PlanState> = {};
  if (Array.isArray(raw.owned)) {
    const owned = raw.owned.filter((o) => o && typeof o.key === "string" && refOk(o.ref) && num(o.valueNow, 0, 1e6)).slice(0, 3);
    if (owned.length) out.owned = owned;
  }
  if (refOk(raw.candRef) && String(raw.candRef).startsWith("ev:")) out.candRef = raw.candRef;
  if (Array.isArray(raw.drivers)) {
    const drivers = raw.drivers
      .filter((d) => d && num(d.id, 0, 1e6) && num(d.commuteOneWayMi, 0, 500) && num(d.daysPerWeek, 0, 7))
      .slice(0, 4)
      .map((d) => ({
        id: d.id, commuteOneWayMi: d.commuteOneWayMi, daysPerWeek: d.daysPerWeek,
        ...(WORK_CHARGING_OPTIONS.some((o) => o.v === d.workCharging) ? { workCharging: d.workCharging } : {}),
        ...(num(d.workCentsPerKwh, 0, 100) ? { workCentsPerKwh: d.workCentsPerKwh } : {}),
      }));
    if (drivers.length) out.drivers = drivers;
  }
  if (Array.isArray(raw.trips)) {
    const trips = raw.trips.filter((t) => t && typeof t.id === "string" && typeof t.label === "string" && num(t.oneWayMi, 0, 5000) && num(t.perYear, 0, 365) && num(t.people, 1, 9) && num(t.luggageCuFt, 0, 200) && num(t.towLbs, 0, 40000)).slice(0, 12);
    if (trips.length) out.trips = trips;
  }
  for (const k of ["errandsMiPerWeek", "errandsPeople", "gasPrice", "years", "priceOverride", "gasPriceOverride", "retention5yOverride"] as const) {
    const v = raw[k];
    const [lo, hi] = k === "gasPrice" ? [0.5, 15] : k === "years" ? [1, 20] : k === "retention5yOverride" ? [0, 1] : k === "errandsPeople" ? [1, 9] : [0, 1e6];
    if (v === null && (k === "priceOverride" || k === "gasPriceOverride" || k === "retention5yOverride")) (out as Record<string, unknown>)[k] = null;
    else if (num(v, lo, hi)) (out as Record<string, unknown>)[k] = v;
  }
  if (typeof raw.utilityId === "string" && cat.utilities.some((u) => u.id === raw.utilityId)) out.utilityId = raw.utilityId;
  if (typeof raw.useTOU === "boolean") out.useTOU = raw.useTOU;
  if (raw.replaces === null || (typeof raw.replaces === "string" && (out.owned ?? []).some((o) => o.key === raw.replaces))) out.replaces = raw.replaces;
  if (raw.gasRef === null || raw.gasRef === "auto" || refOk(raw.gasRef)) out.gasRef = raw.gasRef;
  if (raw.homeCharging && ["auto", "l1", "l2", "none"].includes(raw.homeCharging)) out.homeCharging = raw.homeCharging;
  for (const k of ["candUsed", "gasUsed"] as const) {
    const u = raw[k];
    if (u === null) out[k] = null;
    else if (u && typeof u === "object" && ODOMETER_OPTIONS.some((o) => o.v === u.odometer) && (u.price === null || num(u.price, 1, 1e6))) {
      out[k] = { price: u.price, odometer: u.odometer };
    }
  }
  if (raw.finance === null) out.finance = null;
  else if (raw.finance && typeof raw.finance === "object") {
    const f = raw.finance;
    if ((f.aprPct === null || num(f.aprPct, 0, 40)) && TERM_OPTIONS.includes(f.months) && num(f.down, 0, 1e6)) out.finance = { aprPct: f.aprPct, months: f.months, down: f.down };
  }
  if (raw.overrides && typeof raw.overrides === "object") out.overrides = Object.fromEntries(Object.entries(raw.overrides).filter(([a, b]) => typeof a === "string" && typeof b === "string"));
  return Object.keys(out).length ? out : null;
}
