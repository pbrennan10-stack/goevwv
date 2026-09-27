// Household planner engine. Pure functions, no React — used by
// components/HouseholdPlanner.tsx and safe to unit-test.
//
// The unit of analysis is the HOUSEHOLD: the vehicles you own (or would buy),
// each driver's commute, shared errands, and the trips you take. Each use is
// assigned to the cheapest vehicle that can handle it (seats, luggage,
// towing), unless the user overrides. Totals cover an ownership period and
// include purchase price, WV tax, resale, and the value your current
// vehicles lose.
//
// Per-mile energy math reuses lib/calc.ts so the planner and the single-car
// calculator agree.

import {
  ANNUAL_WINTER_KWH_MULTIPLIER,
  DCFC_FALLBACK_RATE_PER_KWH,
  annualEvMaintenance,
  annualIceMaintenance,
  blendedKwhPer100mi,
  dcfcStopsPerRoundTrip,
  effectiveRatePerKwh,
  evInsuranceEstimate,
} from "./calc";
import { cargoSeatsUp } from "./capability";
import type { Capability, FederalData, IceVehicle, Utility, Vehicle } from "./types";

// ---------- Inputs ----------

export interface OwnershipAssumptions {
  ownership_years_default: number;
  wv_purchase_tax: { rate: number; trade_in_reduces_base: boolean; title_fee_usd: number };
  retention_5yr: { bev: number; phev: number; gas: number; gas_truck: number };
  older_vehicle_annual_depreciation: number;
  default_owned_value_usd: number;
}

export interface OwnedInput {
  key: string;
  ref: string;            // "ice:<id>" or "ev:<id>"
  valueNow: number;       // what it's worth today
  mpgOverride?: number;   // gas only: your real-world mpg
}

export interface CandidateInput {
  ref: string;            // "ev:<id>" (or "ice:<id>" for a new gas alternative)
  price: number;          // what you'd pay before tax (MSRP + destination by default)
  replaces: string | null; // owned key it replaces, or null = add as another vehicle
}

export interface DriverInput {
  id: number;
  commuteOneWayMi: number; // 0 = no commute
  daysPerWeek: number;
}

export interface TripInput {
  id: string;
  label: string;
  oneWayMi: number;
  perYear: number;
  people: number;
  luggageCuFt: number;
  towLbs: number;
}

export interface HouseholdInput {
  owned: OwnedInput[];
  candidate: CandidateInput | null;
  // Optional: the NEW gas vehicle you'd otherwise buy (same "replaces").
  gasAlternative: { ref: string; price: number } | null;
  drivers: DriverInput[];
  errandsMiPerWeek: number;
  errandsPeople: number;
  trips: TripInput[];
  utilityId: string;
  useTOU: boolean;
  gasPrice: number;
  years: number;
  overrides: Record<string, string>; // useId -> unit key
  // User's own estimate of the share of price the NEW vehicle keeps after
  // 5 years (0–1). null = use the sourced segment default.
  retention5yOverride: number | null;
}

export interface Catalog {
  evs: Vehicle[];
  ice: IceVehicle[];
  utilities: Utility[];
  fed: FederalData;
  own: OwnershipAssumptions;
}

// ---------- Units (vehicles in a scenario) ----------

export type Powertrain = "gas" | "bev" | "phev";

export interface Unit {
  key: string;
  name: string;
  short: string;
  pt: Powertrain;
  isNew: boolean;
  cap: Capability;
  ev?: Vehicle;
  ice?: IceVehicle;
  mpg: number;               // gas mpg (gas cars; PHEV hybrid mpg)
  cls: string;
}

export function resolveUnit(ref: string, key: string, cat: Catalog, mpgOverride?: number, isNew = false): Unit | null {
  const [kind, id] = ref.split(":");
  if (kind === "ev") {
    const v = cat.evs.find((x) => x.id === id);
    if (!v) return null;
    return {
      key, isNew, ev: v, cap: v, cls: v.class,
      name: `${v.year} ${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`,
      short: `${v.model}`,
      pt: v.powertrain === "phev" ? "phev" : "bev",
      mpg: v.efficiency_mpg_hybrid ?? 35,
    };
  }
  if (kind === "ice") {
    const v = cat.ice.find((x) => x.id === id);
    if (!v) return null;
    const cap: Capability = { seats: v.seats ?? 5, ...v } as Capability;
    const year = isNew && v.new_model_year ? v.new_model_year : v.year;
    const trim = isNew && v.new_trim ? v.new_trim : v.trim;
    const baseMpg = isNew && v.new_mpg_combined ? v.new_mpg_combined : v.mpg_combined;
    return {
      key, isNew, ice: v, cap, cls: v.class,
      name: `${year} ${v.make} ${v.model}${trim ? ` ${trim}` : ""}`,
      short: v.model,
      pt: "gas",
      mpg: mpgOverride && mpgOverride > 0 ? mpgOverride : baseMpg,
    };
  }
  return null;
}

// ---------- Uses ----------

export interface Use {
  id: string;
  label: string;
  kind: "daily" | "trip";
  miles: number;          // per year
  roundTripMi: number;    // daily: one day's round trip; trip: one full round trip
  timesPerYear: number;   // daily: driving days; trip: trips
  oneWayMi: number;       // trips only
  people: number;
  luggageCuFt: number;
  towLbs: number;
}

export function buildUses(h: HouseholdInput): Use[] {
  const uses: Use[] = [];
  h.drivers.forEach((d, i) => {
    if (d.commuteOneWayMi <= 0 || d.daysPerWeek <= 0) return;
    const days = d.daysPerWeek * 50; // two weeks off
    uses.push({
      id: `commute-${d.id}`, label: `Driver ${i + 1} commute`, kind: "daily",
      miles: d.commuteOneWayMi * 2 * days, roundTripMi: d.commuteOneWayMi * 2,
      timesPerYear: days, oneWayMi: d.commuteOneWayMi, people: 1, luggageCuFt: 0, towLbs: 0,
    });
  });
  if (h.errandsMiPerWeek > 0) {
    uses.push({
      id: "errands", label: "Errands & school runs", kind: "daily",
      miles: h.errandsMiPerWeek * 52, roundTripMi: h.errandsMiPerWeek / 5,
      timesPerYear: 260, oneWayMi: 0, people: h.errandsPeople, luggageCuFt: 0, towLbs: 0,
    });
  }
  for (const t of h.trips) {
    if (t.perYear <= 0 || t.oneWayMi <= 0) continue;
    uses.push({
      id: `trip-${t.id}`, label: t.label, kind: "trip",
      miles: t.oneWayMi * 2 * t.perYear, roundTripMi: t.oneWayMi * 2,
      timesPerYear: t.perYear, oneWayMi: t.oneWayMi,
      people: t.people, luggageCuFt: t.luggageCuFt, towLbs: t.towLbs,
    });
  }
  return uses;
}

// ---------- Fit ----------

export type FitLevel = "ok" | "tight" | "no";
export interface Fit { level: FitLevel; text: string; dcfcStopsEachWay?: number; addedMin?: number }

const TOW_RANGE_FACTOR = 0.55; // towing near capacity cuts EV range ~40–50%

export function fit(u: Unit, use: Use): Fit {
  const c = u.cap;
  if (use.towLbs > 0) {
    if (!c.towing_lbs) return { level: "no", text: c.towing_lbs === 0 ? "Not rated for towing" : "No published tow rating" };
    if (use.towLbs > c.towing_lbs) return { level: "no", text: `Tows ${c.towing_lbs.toLocaleString("en-US")} lb max — needs ${use.towLbs.toLocaleString("en-US")}` };
  }
  if (use.people > c.seats) return { level: "no", text: `Seats ${c.seats} — needs ${use.people}` };

  if (use.luggageCuFt > 0 && !c.bed_length_in) {
    const room = cargoSeatsUp(c);
    if (room == null) return { level: "tight", text: "Luggage space unknown — check in person" };
    if (room < use.luggageCuFt * 0.85) return { level: "no", text: `${Math.round(room)} cu ft of luggage room — needs about ${use.luggageCuFt}` };
    if (room < use.luggageCuFt) return { level: "tight", text: `Tight on luggage (${Math.round(room)} cu ft) — pack light or add a roof box` };
  }

  if (u.pt === "bev" && u.ev) {
    const winter = u.ev.winter_range_mi ?? (u.ev.epa_range_mi ?? 200) * 0.72;
    if (use.kind === "daily" && use.roundTripMi > winter * 0.9) {
      return { level: "tight", text: `${Math.round(use.roundTripMi)}-mi day is close to the ${Math.round(winter)}-mi winter range — plan to charge midday in January` };
    }
    if (use.kind === "trip") {
      let hwy = u.ev.highway_range_mi ?? Math.round((u.ev.epa_range_mi ?? 200) * 0.8);
      if (use.towLbs > 0) hwy = hwy * TOW_RANGE_FACTOR;
      const { stops } = dcfcStopsPerRoundTrip(hwy, use.oneWayMi);
      const each = stops / 2;
      const perStop = (u.ev.charging.dcfc_10_to_80_min ?? 30) * 0.8 + 4;
      const room = cargoSeatsUp(c);
      const space = c.bed_length_in ? "bed" : room != null ? `${Math.round(room)} cu ft` : "";
      const lead = `Fits${use.people > 1 ? ` ${use.people}` : ""}${space ? ` (${space})` : ""}`;
      if (each === 0) return { level: "ok", text: `${lead} · no charging stops needed${use.towLbs ? " even towing" : ""}`, dcfcStopsEachWay: 0, addedMin: 0 };
      const mins = Math.round(each * perStop);
      return {
        level: use.towLbs > 0 && each >= 3 ? "tight" : "ok",
        text: `${lead} · ${each} fast-charging stop${each > 1 ? "s" : ""} each way (~${mins} min)${use.towLbs ? " while towing" : ""}`,
        dcfcStopsEachWay: each, addedMin: mins,
      };
    }
  }
  if (use.kind === "trip") {
    if (u.pt === "phev") return { level: "ok", text: `Fits · first ${u.ev?.epa_range_mi_electric ?? "?"} mi electric, then gas` };
    return { level: "ok", text: "Fits · gas stops as usual" };
  }
  return { level: "ok", text: "Fits" };
}

// ---------- Costs ----------

interface Rates { homeRate: number; meterAnnualUsd: number; dcfcRate: number; gasPrice: number }

// Variable (per-use) annual energy cost for a unit.
export function energyCost(u: Unit, use: Use, r: Rates): number {
  if (u.pt === "gas") return (use.miles / u.mpg) * r.gasPrice;
  const v = u.ev!;
  const winter = ANNUAL_WINTER_KWH_MULTIPLIER;
  const hwyFrac = use.kind === "trip" ? 0.9 : 0.45;
  const kwhPerMi = (blendedKwhPer100mi(v, hwyFrac, use.kind === "trip" ? 70 : 55) / 100) * winter;
  if (u.pt === "bev") {
    if (use.kind === "trip") {
      let hwy = v.highway_range_mi ?? Math.round((v.epa_range_mi ?? 200) * 0.8);
      const towMult = use.towLbs > 0 ? 1 / TOW_RANGE_FACTOR : 1;
      if (use.towLbs > 0) hwy *= TOW_RANGE_FACTOR;
      const { extraMiRoundTrip } = dcfcStopsPerRoundTrip(hwy, use.oneWayMi);
      const dcfcMi = Math.min(use.roundTripMi, extraMiRoundTrip) * use.timesPerYear;
      const homeMi = use.miles - dcfcMi;
      return (homeMi * r.homeRate + dcfcMi * r.dcfcRate) * kwhPerMi * towMult;
    }
    return use.miles * kwhPerMi * r.homeRate;
  }
  // PHEV: electric until the battery is empty each day / each trip leg, then gas.
  const eRange = (v.epa_range_mi_electric ?? 0) / winter;
  // One full battery per day or per trip (matches lib/calc.ts: PHEV owners
  // rarely charge on the road).
  const eMiEach = Math.min(use.roundTripMi, eRange);
  const eMi = Math.min(use.miles, eMiEach * use.timesPerYear);
  const gasMi = use.miles - eMi;
  return eMi * kwhPerMi * r.homeRate + (gasMi / u.mpg) * r.gasPrice;
}

function maintenanceFor(u: Unit, miles: number): number {
  if (u.ice) return annualIceMaintenance(u.ice, miles).total_usd;
  if (u.ev) {
    const m = annualEvMaintenance(u.ev, miles).total_usd;
    return u.pt === "phev" ? m + 90 : m; // PHEVs still need occasional oil changes
  }
  return 0;
}

function insuranceFor(u: Unit): number {
  if (u.ice) return u.ice.annual_insurance_usd;
  if (u.ev) return evInsuranceEstimate(u.ev);
  return 0;
}

function registrationFor(u: Unit, fed: FederalData): number {
  const base = fed.wv_state_fees.standard_registration_fee?.amount_usd ?? 0;
  if (u.pt === "bev") return base + fed.wv_state_fees.bev_annual_fee.amount_usd;
  if (u.pt === "phev") return base + fed.wv_state_fees.phev_annual_fee.amount_usd;
  return base;
}

// ---------- Scenario ----------

export interface UnitResult {
  unit: Unit;
  miles: number;
  share: number;
  uses: Use[];
  energy: number;
  maintenance: number;
  insurance: number;
  registration: number;
  runningPerYear: number;
  capitalOverPeriod: number;  // depreciation (owned) or net purchase cost (new)
  capitalNote: string;
}

export interface ScenarioResult {
  units: UnitResult[];
  assignment: Record<string, string | null>;
  unassigned: Use[];
  runningPerYear: number;
  capitalOverPeriod: number;
  totalOverPeriod: number;
  perYear: number;
  upfrontCash: number;       // new vehicle only: price + tax + title − trade-in
}

export function retention(pt: Powertrain, cls: string, years: number, own: OwnershipAssumptions): number {
  const r5 = pt === "bev" ? own.retention_5yr.bev
    : pt === "phev" ? own.retention_5yr.phev
    : cls === "truck" ? own.retention_5yr.gas_truck
    : own.retention_5yr.gas;
  // Geometric interpolation from the 5-year figure.
  return Math.pow(r5, years / 5);
}

function assign(units: Unit[], uses: Use[], rates: Rates, overrides: Record<string, string>) {
  const out: Record<string, string | null> = {};
  for (const use of uses) {
    const capable = units.filter((u) => fit(u, use).level !== "no");
    if (!capable.length) { out[use.id] = null; continue; }
    const o = overrides[use.id];
    if (o && capable.some((u) => u.key === o)) { out[use.id] = o; continue; }
    // Cheapest capable. Ties / near-ties prefer a vehicle with "ok" over "tight".
    const scored = capable.map((u) => {
      const f = fit(u, use);
      return { u, cost: energyCost(u, use, rates) + (f.level === "tight" ? 150 : 0) };
    });
    scored.sort((a, b) => a.cost - b.cost);
    out[use.id] = scored[0].u.key;
  }
  return out;
}

export function runScenario(
  units: Unit[],
  uses: Use[],
  h: HouseholdInput,
  cat: Catalog,
  opts: { overrides: Record<string, string>; owned: OwnedInput[]; soldKey: string | null; candidatePrice: number | null },
): ScenarioResult {
  const utility = cat.utilities.find((u) => u.id === h.utilityId) ?? cat.utilities[0];
  const { rate, meterAnnualUsd } = effectiveRatePerKwh(utility, h.useTOU);
  const rates: Rates = {
    homeRate: rate, meterAnnualUsd,
    dcfcRate: cat.fed.calculation_notes.dcfc_rate_per_kwh?.current ?? DCFC_FALLBACK_RATE_PER_KWH,
    gasPrice: h.gasPrice,
  };
  const assignment = assign(units, uses, rates, opts.overrides);
  const totalMiles = uses.reduce((s, u) => s + u.miles, 0);
  const own = cat.own;
  const Y = h.years;
  let upfrontCash = 0;
  let meterCharged = false;

  const unitResults: UnitResult[] = units.map((unit) => {
    const mine = uses.filter((u) => assignment[u.id] === unit.key);
    const miles = mine.reduce((s, u) => s + u.miles, 0);
    let energy = mine.reduce((s, u) => s + energyCost(unit, u, rates), 0);
    if (unit.pt !== "gas" && h.useTOU && !meterCharged && rates.meterAnnualUsd) {
      energy += rates.meterAnnualUsd; meterCharged = true;
    }
    const maintenance = maintenanceFor(unit, miles);
    const insurance = insuranceFor(unit);
    const registration = registrationFor(unit, cat.fed);
    const runningPerYear = energy + maintenance + insurance + registration;

    let capitalOverPeriod = 0;
    let capitalNote = "";
    if (unit.isNew) {
      const price = opts.candidatePrice ?? newVehiclePrice(unit);
      const tradeIn = opts.soldKey ? opts.owned.find((o) => o.key === opts.soldKey)?.valueNow ?? 0 : 0;
      const taxBase = own.wv_purchase_tax.trade_in_reduces_base ? Math.max(0, price - tradeIn) : price;
      const tax = taxBase * own.wv_purchase_tax.rate + own.wv_purchase_tax.title_fee_usd;
      // The resale slider is the user's view of the EV; a gas alternative
      // always uses the sourced segment figure.
      const r5 = unit.pt !== "gas" ? h.retention5yOverride : null;
      const resale = price * (r5 != null ? Math.pow(r5, Y / 5) : retention(unit.pt, unit.cls, Y, own));
      capitalOverPeriod = price + tax - resale;
      upfrontCash = price + tax - tradeIn;
      capitalNote = `$${Math.round(price).toLocaleString("en-US")} + $${Math.round(tax).toLocaleString("en-US")} tax & title − ~$${Math.round(resale).toLocaleString("en-US")} resale after ${Y} yr`;
    } else {
      const o = opts.owned.find((x) => x.key === unit.key);
      const value = o?.valueNow ?? own.default_owned_value_usd;
      const later = value * Math.pow(1 - own.older_vehicle_annual_depreciation, Y);
      capitalOverPeriod = value - later;
      capitalNote = `Loses ~$${Math.round(capitalOverPeriod).toLocaleString("en-US")} of value over ${Y} yr`;
    }

    return {
      unit, miles, share: totalMiles ? miles / totalMiles : 0, uses: mine,
      energy, maintenance, insurance, registration, runningPerYear,
      capitalOverPeriod, capitalNote,
    };
  });

  const runningPerYear = unitResults.reduce((s, r) => s + r.runningPerYear, 0);
  const capitalOverPeriod = unitResults.reduce((s, r) => s + r.capitalOverPeriod, 0);
  const totalOverPeriod = runningPerYear * Y + capitalOverPeriod;
  return {
    units: unitResults, assignment,
    unassigned: uses.filter((u) => !assignment[u.id]),
    runningPerYear, capitalOverPeriod, totalOverPeriod, perYear: totalOverPeriod / Y,
    upfrontCash,
  };
}

// "What would a USED one need to cost?" Given a scenario with a new vehicle,
// solve for the purchase price at which buying that model used makes the
// scenario's total equal `targetTotal` (e.g. the new-gas or keep-today total).
// A used vehicle runs the same (efficiency, fees, maintenance) and loses value
// at the SAME yearly rate as a new one of its type (the retention curve is
// geometric, so a used EV keeps r5^(Y/5) of its price just like a new one —
// including the user's resale slider). Using a gentler rate for used than new
// would let a "used" one priced above new come out ahead, which is nonsense.
// WV sales tax applies to price minus trade-in. Insurance is left at the
// new-vehicle estimate (conservative). Returns null when even a free vehicle
// wouldn't get there.
export function usedBreakEvenPrice(
  scenario: ScenarioResult,
  targetTotal: number,
  h: HouseholdInput,
  cat: Catalog,
): number | null {
  const unit = scenario.units.find((u) => u.unit.isNew);
  if (!unit) return null;
  const fixed = scenario.totalOverPeriod - unit.capitalOverPeriod; // everything except this vehicle's price/resale
  const r5 = unit.unit.pt !== "gas" && h.retention5yOverride != null
    ? h.retention5yOverride
    : retention(unit.unit.pt, unit.unit.cls, 5, cat.own);
  const keep = Math.pow(r5, h.years / 5); // share of price left at the end
  const { rate, title_fee_usd: title, trade_in_reduces_base } = cat.own.wv_purchase_tax;
  const sold = h.candidate?.replaces;
  const tradeIn = sold ? h.owned.find((o) => o.key === sold)?.valueNow ?? 0 : 0;
  const budget = targetTotal - fixed - title; // what price + tax − resale may add up to
  // capital(P) = P + rate·(P − tradeIn) − keep·P   when P ≥ tradeIn (or no trade-in credit)
  let p = trade_in_reduces_base
    ? (budget + rate * tradeIn) / (1 + rate - keep)
    : budget / (1 + rate - keep);
  if (trade_in_reduces_base && p < tradeIn) p = budget / (1 - keep); // taxable base floors at 0
  return p > 0 ? p : null;
}

// Default price of a new vehicle: MSRP + destination when known.
export function newVehiclePrice(u: Unit): number {
  if (u.ev) return u.ev.msrp_usd + (u.ev.destination_usd ?? 0);
  if (u.ice) return (u.ice.new_msrp_usd ?? 0) + (u.ice.new_destination_usd ?? 0);
  return 0;
}

export interface PlanResult {
  uses: Use[];
  today: ScenarioResult;
  plan: ScenarioResult | null;
  planUnits: Unit[];
  gasAlt: ScenarioResult | null;
  gasAltUnits: Unit[];
}

export function planHousehold(h: HouseholdInput, cat: Catalog): PlanResult {
  const uses = buildUses(h);
  const ownedUnits = h.owned
    .map((o) => resolveUnit(o.ref, o.key, cat, o.mpgOverride))
    .filter((u): u is Unit => !!u);
  const today = runScenario(ownedUnits, uses, h, cat, {
    overrides: {}, owned: h.owned, soldKey: null, candidatePrice: null,
  });
  const sold = h.candidate?.replaces ?? null;
  const withNew = (ref: string, price: number, overrides: Record<string, string>) => {
    const unit = resolveUnit(ref, "new", cat, undefined, true);
    if (!unit) return null;
    const units = [...ownedUnits.filter((u) => u.key !== sold), unit];
    return { units, result: runScenario(units, uses, h, cat, { overrides, owned: h.owned, soldKey: sold, candidatePrice: price }) };
  };
  const ev = h.candidate ? withNew(h.candidate.ref, h.candidate.price, h.overrides) : null;
  const gas = h.candidate && h.gasAlternative ? withNew(h.gasAlternative.ref, h.gasAlternative.price, {}) : null;
  return {
    uses, today,
    plan: ev?.result ?? null, planUnits: ev?.units ?? ownedUnits,
    gasAlt: gas?.result ?? null, gasAltUnits: gas?.units ?? [],
  };
}
