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
// Fairness rules (Sept 27 2026 review): winter, speed, resale uncertainty and
// price trends are applied to BOTH sides; one-time costs of EV ownership (a
// home charger) and of keeping an old car (repairs rising with miles) are
// both counted. Per-mile energy math reuses lib/calc.ts so the planner and
// the single-car calculator agree.

import {
  ANNUAL_WINTER_KWH_MULTIPLIER,
  DCFC_FALLBACK_RATE_PER_KWH,
  HYBRID_WINTER_FUEL_MULTIPLIER,
  ICE_WINTER_FUEL_MULTIPLIER,
  PHEV_MAINTENANCE_EXTRA_USD,
  WORK_WEEKS_PER_YEAR,
  annualEvMaintenance,
  annualIceMaintenance,
  blendedKwhPer100mi,
  dcfcRateFor,
  dcfcStopsPerRoundTrip,
  effectiveRatePerKwh,
  evInsuranceEstimate,
  insuranceAtValue,
  isHybridTrim,
} from "./calc";
import type { BackupPowerData } from "./backup";
import { cargoSeatsUp } from "./capability";
import type { Capability, FederalData, IceVehicle, Utility, Vehicle } from "./types";

// ---------- Inputs ----------

export type ResaleScenario = "low" | "mid" | "high";
export type OdometerBand = "under_50k" | "50k_100k" | "over_100k";
export type HomeCharging = "auto" | "l1" | "l2" | "none";
// Charging at work, per commuting driver: free, or paid — at the price the
// user enters, else the average WV business (commercial) rate.
export type WorkCharging = "none" | "free" | "paid";

type Range3 = { low: number; mid: number; high: number };

export interface OwnershipAssumptions {
  ownership_years_default: number;
  wv_purchase_tax: { rate: number; trade_in_reduces_base: boolean; title_fee_usd: number };
  retention_scenarios_5yr: { bev: Range3; phev: Range3; gas: Range3; gas_hybrid: Range3; gas_truck: Range3 };
  older_vehicle_annual_depreciation: number;
  used_vehicle_annual_depreciation: number;
  default_owned_value_usd: number;
  owned_maintenance_multiplier: { gas: Record<OdometerBand, number>; ev: Record<OdometerBand, number> };
  home_charging_setup: { level1_usd: number; level2_installed_usd: number; level1_max_daily_mi: number };
  // Starting APRs for the "paying monthly?" option (national averages; the user can enter their own).
  apr_reference: { new_60mo: number; used: number; term_months: number; source: string };
}

// Paying monthly: an amortized loan on what you buy, after the trade-in and
// any cash down. Applies to the EV and to the gas alternative alike.
export interface FinancingInput {
  aprNew: number;      // yearly rate on a vehicle bought new, e.g. 0.07
  aprUsed: number;     // bought used, e.g. 0.106
  termMonths: number;  // 60
  cashDown: number;    // cash at signing beyond the trade-in
}

export interface OwnedInput {
  key: string;
  ref: string;            // "ice:<id>" or "ev:<id>"
  valueNow: number;       // what it's worth today
  mpgOverride?: number;   // gas only: your real-world mpg
  odometer?: OdometerBand; // default 50k–100k
}

// Buying used instead of new. The price is the one the user found — we never
// guess used prices — so it arrives as the purchase `price`.
export interface UsedPurchase {
  odometer: OdometerBand;
}

export interface CandidateInput {
  ref: string;            // "ev:<id>" (or "ice:<id>" for a new gas alternative)
  price: number;          // what you'd pay before tax (MSRP + destination by default)
  replaces: string | null; // owned key it replaces, or null = add as another vehicle
  used?: UsedPurchase | null; // null/absent = bought new
}

export interface DriverInput {
  id: number;
  commuteOneWayMi: number; // 0 = no commute
  daysPerWeek: number;
  workCharging?: WorkCharging; // default "none"
  workCentsPerKwh?: number;    // paid: what the employer charges today; default = WV business average
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
  // Optional: the gas vehicle you'd otherwise buy (same "replaces"), new or used.
  gasAlternative: { ref: string; price: number; used?: UsedPurchase | null } | null;
  drivers: DriverInput[];
  errandsMiPerWeek: number;
  errandsPeople: number;
  trips: TripInput[];
  utilityId: string;
  useTOU: boolean;
  gasPrice: number;
  years: number;
  overrides: Record<string, string>; // useId -> unit key
  // User's own estimate of the share of LIST price the new EV keeps after
  // 5 years (0–1). null = use the sourced scenario.
  retention5yOverride: number | null;
  resaleScenario?: ResaleScenario;   // default "mid"
  homeCharging?: HomeCharging;       // default "auto"
  financing?: FinancingInput | null; // null/absent = paying cash
}

export interface Catalog {
  evs: Vehicle[];
  ice: IceVehicle[];
  utilities: Utility[];
  fed: FederalData;
  own: OwnershipAssumptions;
  backup?: BackupPowerData; // data/backup_power.yaml — the shopping list's backup-power mark
}

// ---------- Units (vehicles in a scenario) ----------

export type Powertrain = "gas" | "bev" | "phev";

export interface Unit {
  key: string;
  name: string;
  short: string;
  pt: Powertrain;
  isNew: boolean;            // bought in this plan (new, or used when usedOdometer is set)
  usedOdometer?: OdometerBand; // bought used, with about this many miles on it
  hybrid: boolean;           // conventional (non-plug-in) hybrid
  cap: Capability;
  ev?: Vehicle;
  ice?: IceVehicle;
  mpg: number;               // gas mpg (gas cars; PHEV hybrid mpg)
  cls: string;
}

// Short display name: the model, or make + model when the model is only a
// number ("Polestar 2" and "Ram 1500", not "2" and "1500").
export function shortName(v: { make: string; model: string }): string {
  return /^\d+$/.test(v.model.trim()) ? `${v.make} ${v.model}` : v.model;
}

export function resolveUnit(ref: string, key: string, cat: Catalog, mpgOverride?: number, isNew = false, usedOdometer?: OdometerBand): Unit | null {
  const [kind, id] = ref.split(":");
  // A used one's model year isn't known, so its name leaves the year off.
  const usedBand = isNew ? usedOdometer : undefined;
  const used = usedBand ? { usedOdometer: usedBand } : {};
  if (kind === "ev") {
    const v = cat.evs.find((x) => x.id === id);
    if (!v) return null;
    return {
      key, isNew, ...used, ev: v, cap: v, cls: v.class, hybrid: false,
      name: `${usedBand ? "" : `${v.year} `}${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`,
      short: shortName(v),
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
      key, isNew, ...used, ice: v, cap, cls: v.class, hybrid: isHybridTrim(trim),
      name: `${usedBand ? "" : `${year} `}${v.make} ${v.model}${trim ? ` ${trim}` : ""}`,
      short: shortName(v),
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
  workCharging?: WorkCharging; // commutes only
  workRatePerKwh?: number;     // commutes only: the employer's price today ($/kWh), if entered
}

export function buildUses(h: HouseholdInput): Use[] {
  const uses: Use[] = [];
  h.drivers.forEach((d, i) => {
    if (d.commuteOneWayMi <= 0 || d.daysPerWeek <= 0) return;
    const days = d.daysPerWeek * WORK_WEEKS_PER_YEAR;
    uses.push({
      id: `commute-${d.id}`, label: `Driver ${i + 1} commute`, kind: "daily",
      miles: d.commuteOneWayMi * 2 * days, roundTripMi: d.commuteOneWayMi * 2,
      timesPerYear: days, oneWayMi: d.commuteOneWayMi, people: 1, luggageCuFt: 0, towLbs: 0,
      workCharging: d.workCharging ?? "none",
      ...(d.workCentsPerKwh != null ? { workRatePerKwh: d.workCentsPerKwh / 100 } : {}),
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

export const TOW_RANGE_FACTOR = 0.55; // towing near capacity cuts EV range ~40–50%

// EV batteries lose ~2% of range a year (Geotab: 1.5%/yr home-charged, 2.3%
// fleet average; Recurrent similar). Trip and winter fit use the AVERAGE range
// over the ownership period. Energy per mile is unaffected.
export function batteryRangeFactor(years: number): number {
  return Math.max(0.8, 1 - 0.02 * (years / 2));
}

export function fit(u: Unit, use: Use, years = 0): Fit {
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
    const fade = u.isNew ? batteryRangeFactor(years) : 1;
    const winter = (u.ev.winter_range_mi ?? (u.ev.epa_range_mi ?? 200) * 0.72) * fade;
    if (use.kind === "daily" && use.roundTripMi > winter * 0.9) {
      return { level: "tight", text: `${Math.round(use.roundTripMi)}-mi day is close to the ${Math.round(winter)}-mi winter range — plan to charge midday in January` };
    }
    if (use.kind === "trip") {
      let hwy = (u.ev.highway_range_mi ?? Math.round((u.ev.epa_range_mi ?? 200) * 0.8)) * fade;
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

interface Rates {
  homeRate: number;          // $/kWh at home (or at public chargers if no home charging)
  workRate: number;          // $/kWh when paying to charge at work: the WV business average
  meterAnnualUsd: number;
  elecMult: number;          // average electricity price rise over the period
  gasPrice: number;
  noHomeCharging: boolean;
}

// Average of (1 + r)^y for y = 0..years−1: what a price rising r a year
// averages over the ownership period.
export function averageEscalation(rate: number, years: number): number {
  const n = Math.max(1, Math.round(years));
  let s = 0;
  for (let y = 0; y < n; y++) s += Math.pow(1 + rate, y);
  return s / n;
}

function gasWinterMult(u: Unit): number {
  if (u.pt === "phev" || u.hybrid) return HYBRID_WINTER_FUEL_MULTIPLIER;
  return ICE_WINTER_FUEL_MULTIPLIER;
}

// Variable (per-use) annual energy cost for a unit.
export function energyCost(u: Unit, use: Use, r: Rates, fed: FederalData): number {
  if (u.pt === "gas") return (use.miles / u.mpg) * gasWinterMult(u) * r.gasPrice;
  const v = u.ev!;
  const winter = ANNUAL_WINTER_KWH_MULTIPLIER;
  // Road trips use the EPA highway figure; daily driving a city/highway mix.
  // No extra speed penalty: the EPA label already reflects real-world speeds,
  // and gas trips aren't penalized for speed either.
  const hwyFrac = use.kind === "trip" ? 0.9 : 0.45;
  const kwhPerMi = (blendedKwhPer100mi(v, hwyFrac, 55) / 100) * winter;
  const publicRate = dcfcRateFor(v, fed) * r.elecMult;
  const home = r.noHomeCharging ? publicRate : r.homeRate;
  // A commute you can charge at work: free, or paid — the employer's price if
  // entered, else the WV business average (employers usually pass on their
  // commercial rate). A Level 2 session over a workday covers the round trip.
  // Where charging at home is cheaper, that's what you'd use.
  const atWork = use.workCharging === "free" ? 0
    : use.workCharging === "paid" ? (use.workRatePerKwh != null ? use.workRatePerKwh * r.elecMult : r.workRate)
    : null;
  if (u.pt === "bev") {
    if (use.kind === "trip") {
      let hwy = v.highway_range_mi ?? Math.round((v.epa_range_mi ?? 200) * 0.8);
      const towMult = use.towLbs > 0 ? 1 / TOW_RANGE_FACTOR : 1;
      if (use.towLbs > 0) hwy *= TOW_RANGE_FACTOR;
      const { extraMiRoundTrip } = dcfcStopsPerRoundTrip(hwy, use.oneWayMi);
      const dcfcMi = Math.min(use.roundTripMi, extraMiRoundTrip) * use.timesPerYear;
      const homeMi = use.miles - dcfcMi;
      return (homeMi * home + dcfcMi * publicRate) * kwhPerMi * towMult;
    }
    return use.miles * kwhPerMi * (atWork == null ? home : Math.min(atWork, home));
  }
  // PHEV: electric until the battery is empty each day / each trip, then gas.
  // One full battery per day or per trip (PHEV owners rarely charge on the road).
  const eRange = (v.epa_range_mi_electric ?? 0) / winter;
  if (atWork != null) {
    // Charging at work adds a battery's worth each workday — a second one on
    // top of home charging, or the only one without it. The cheaper place
    // fills the first battery.
    const both = !r.noHomeCharging;
    const cheap = both ? Math.min(atWork, home) : atWork;
    const firstMi = Math.min(use.miles, Math.min(use.roundTripMi, eRange) * use.timesPerYear);
    const secondEach = both ? Math.min(Math.max(0, use.roundTripMi - eRange), eRange) : 0;
    const secondMi = Math.min(use.miles - firstMi, secondEach * use.timesPerYear);
    const gasMi = use.miles - firstMi - secondMi;
    return (firstMi * cheap + secondMi * Math.max(atWork, home)) * kwhPerMi + (gasMi / u.mpg) * gasWinterMult(u) * r.gasPrice;
  }
  const eMiEach = Math.min(use.roundTripMi, eRange);
  const eMi = Math.min(use.miles, eMiEach * use.timesPerYear);
  const gasMi = use.miles - eMi;
  return eMi * kwhPerMi * home + (gasMi / u.mpg) * gasWinterMult(u) * r.gasPrice;
}

// Upkeep rises with mileage for vehicles you own and ones you'd buy used.
function odometerMult(u: Unit, band: OdometerBand | undefined, own: OwnershipAssumptions): number {
  if (u.isNew && !u.usedOdometer) return 1;
  const table = u.pt === "gas" ? own.owned_maintenance_multiplier.gas : own.owned_maintenance_multiplier.ev;
  return table[u.usedOdometer ?? band ?? "50k_100k"] ?? 1;
}

function maintenanceFor(u: Unit, miles: number, band: OdometerBand | undefined, own: OwnershipAssumptions): number {
  let base = 0;
  if (u.ice) base = annualIceMaintenance(u.ice, miles).total_usd;
  else if (u.ev) base = annualEvMaintenance(u.ev, miles).total_usd + (u.pt === "phev" ? PHEV_MAINTENANCE_EXTRA_USD : 0);
  return base * odometerMult(u, band, own);
}

// List price of the vehicle new (MSRP + destination). Destination fees that
// weren't found fall back to a typical $1,500 rather than $0, so a missing
// fee never makes a vehicle look cheaper.
export const DESTINATION_FALLBACK_USD = 1500;
export function newVehiclePrice(u: Unit): number {
  if (u.ev) return u.ev.msrp_usd + (u.ev.destination_usd ?? DESTINATION_FALLBACK_USD);
  if (u.ice) return (u.ice.new_msrp_usd ?? 0) + (u.ice.new_destination_usd ?? DESTINATION_FALLBACK_USD);
  return 0;
}
export function destinationIsEstimated(u: Unit): boolean {
  return u.ev ? u.ev.destination_usd == null : u.ice ? u.ice.new_destination_usd == null : false;
}

function insuranceFor(u: Unit, value: number | null): number {
  if (u.ice) {
    if (value == null) return u.ice.annual_insurance_usd;
    return insuranceAtValue(u.ice.annual_insurance_usd, newVehiclePrice(u), value);
  }
  if (u.ev) return value == null ? evInsuranceEstimate(u.ev) : evInsuranceEstimate(u.ev, value);
  return 0;
}

function registrationFor(u: Unit, fed: FederalData): number {
  const base = fed.wv_state_fees.standard_registration_fee?.amount_usd ?? 0;
  if (u.pt === "bev") return base + fed.wv_state_fees.bev_annual_fee.amount_usd;
  if (u.pt === "phev") return base + fed.wv_state_fees.phev_annual_fee.amount_usd;
  return base;
}

// ---------- Resale ----------

export function retentionSegment(u: Pick<Unit, "pt" | "cls" | "hybrid">): keyof OwnershipAssumptions["retention_scenarios_5yr"] {
  if (u.pt === "bev") return "bev";
  if (u.pt === "phev") return "phev";
  if (u.cls === "truck") return "gas_truck";
  if (u.hybrid) return "gas_hybrid";
  return "gas";
}

// Share of list price kept after `years`. The 5-year figure follows a
// geometric curve; after year 5 depreciation flattens to the older-vehicle
// rate instead of continuing at the steep new-car pace.
export function retentionAfter(r5: number, years: number, own: OwnershipAssumptions): number {
  const first = Math.pow(r5, Math.min(years, 5) / 5);
  const tail = Math.pow(1 - own.older_vehicle_annual_depreciation, Math.max(0, years - 5));
  return first * tail;
}

// A vehicle bought USED (typically 2–4 years old) is past its steepest drop:
// it keeps this share of what you paid after `years`. Shared by the used
// purchase math and usedBreakEvenPrice so the two answers always agree.
export function usedRetentionAfter(years: number, own: OwnershipAssumptions): number {
  return Math.pow(1 - own.used_vehicle_annual_depreciation, years);
}

export function retention5(u: Pick<Unit, "pt" | "cls" | "hybrid">, scenario: ResaleScenario, own: OwnershipAssumptions): number {
  return own.retention_scenarios_5yr[retentionSegment(u)][scenario];
}

// Backwards-compatible helper: retention after `years` for a powertrain/class.
export function retention(pt: Powertrain, cls: string, years: number, own: OwnershipAssumptions, scenario: ResaleScenario = "mid", hybrid = false): number {
  return retentionAfter(retention5({ pt, cls, hybrid }, scenario, own), years, own);
}

// ---------- Home charging ----------

export interface ChargingPlan {
  mode: "l1" | "l2" | "none";
  setupUsd: number;      // one-time, after rebates
  rebateUsd: number;
  reason: string;
}

export function resolveHomeCharging(h: HouseholdInput, uses: Use[], cat: Catalog, ownsPlugIn: boolean): ChargingPlan {
  const s = cat.own.home_charging_setup;
  const utility = cat.utilities.find((u) => u.id === h.utilityId);
  const rebateUsd = Math.min(
    s.level2_installed_usd,
    (utility?.rebates ?? []).filter((r) => r.type === "l2_charger").reduce((t, r) => t + (r.amount_usd ?? 0), 0),
  );
  const pick = h.homeCharging ?? "auto";
  if (pick === "none") return { mode: "none", setupUsd: 0, rebateUsd: 0, reason: "No place to charge at home — every mile priced at public charging rates" };
  const longestDay = Math.max(0, ...uses.filter((u) => u.kind === "daily").map((u) => u.roundTripMi));
  let mode: "l1" | "l2" = pick === "l1" ? "l1" : pick === "l2" ? "l2" : longestDay <= s.level1_max_daily_mi ? "l1" : "l2";
  if (h.useTOU) mode = "l2"; // the off-peak EV rate needs a hard-wired circuit
  if (ownsPlugIn) return { mode, setupUsd: 0, rebateUsd: 0, reason: "You already charge at home" };
  if (mode === "l1") return { mode, setupUsd: s.level1_usd, rebateUsd: 0, reason: `A regular outlet covers ~${s.level1_max_daily_mi} mi a night` };
  return {
    mode, setupUsd: Math.max(0, s.level2_installed_usd - rebateUsd), rebateUsd,
    reason: `Level 2 charger installed ~$${s.level2_installed_usd.toLocaleString("en-US")}${rebateUsd ? ` − $${rebateUsd} ${utility?.name ?? "utility"} rebate` : ""}`,
  };
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
  capitalOverPeriod: number;  // depreciation (owned) or net purchase cost (new), incl. loan interest
  capitalNote: string;
  interest: number;           // loan interest inside the period (0 when paying cash or kept)
}

export interface LoanResult {
  amount: number;        // financed: price + tax − trade-in − cash down
  payment: number;       // per month
  months: number;
  apr: number;
  cashAtSigning: number; // cash down (no more than what's owed) + the home charger
}

export interface ScenarioResult {
  units: UnitResult[];
  assignment: Record<string, string | null>;
  unassigned: Use[];
  runningPerYear: number;
  capitalOverPeriod: number;
  totalOverPeriod: number;
  perYear: number;
  upfrontCash: number;       // new vehicle only: price + tax + title + charger − trade-in (the cash figure, financed or not)
  charging: ChargingPlan | null;
  interestOverPeriod: number; // loan interest inside the period, all vehicles (0 when paying cash)
  loan: LoanResult | null;    // the vehicle bought in this scenario, when financed
}

// ---------- Loans ----------

// Standard amortized payment. A zero rate is just principal / months.
export function loanPayment(principal: number, apr: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = apr / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

// What's still owed after k payments.
export function loanBalance(principal: number, apr: number, months: number, k: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const n = Math.min(Math.max(0, k), months);
  const pmt = loanPayment(principal, apr, months);
  const r = apr / 12;
  if (r === 0) return Math.max(0, principal - pmt * n);
  const g = Math.pow(1 + r, n);
  return Math.max(0, principal * g - (pmt * (g - 1)) / r);
}

// Interest inside the first k payments. A loan can outlast the ownership
// period; what's still owed at the sale is principal, paid from the proceeds,
// so only the interest paid by then counts.
export function loanInterest(principal: number, apr: number, months: number, k: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const n = Math.min(Math.max(0, k), months);
  const paid = loanPayment(principal, apr, months) * n;
  return Math.max(0, paid - (principal - loanBalance(principal, apr, months, n)));
}

function assign(units: Unit[], uses: Use[], rates: Rates, overrides: Record<string, string>, years: number, fed: FederalData) {
  const out: Record<string, string | null> = {};
  for (const use of uses) {
    const capable = units.filter((u) => fit(u, use, years).level !== "no");
    if (!capable.length) { out[use.id] = null; continue; }
    const o = overrides[use.id];
    if (o && capable.some((u) => u.key === o)) { out[use.id] = o; continue; }
    // Cheapest capable. Ties / near-ties prefer a vehicle with "ok" over "tight".
    const scored = capable.map((u) => {
      const f = fit(u, use, years);
      return { u, cost: energyCost(u, use, rates, fed) + (f.level === "tight" ? 150 : 0) };
    });
    scored.sort((a, b) => a.cost - b.cost);
    out[use.id] = scored[0].u.key;
  }
  return out;
}

export interface ScenarioOpts {
  overrides: Record<string, string>;
  owned: OwnedInput[];
  soldKey: string | null;
  candidatePrice: number | null;
  scenario: ResaleScenario;
}

export function runScenario(units: Unit[], uses: Use[], h: HouseholdInput, cat: Catalog, opts: ScenarioOpts): ScenarioResult {
  const utility = cat.utilities.find((u) => u.id === h.utilityId) ?? cat.utilities[0];
  const { rate, meterAnnualUsd } = effectiveRatePerKwh(utility, h.useTOU);
  const own = cat.own;
  const Y = h.years;
  const elecMult = averageEscalation(cat.fed.calculation_notes.electricity_annual_increase ?? 0, Y);
  const newPlugIn = units.some((u) => u.isNew && u.pt !== "gas");
  const ownsPlugIn = units.some((u) => !u.isNew && u.pt !== "gas");
  const charging = newPlugIn || ownsPlugIn ? resolveHomeCharging(h, uses, cat, ownsPlugIn) : null;
  const rates: Rates = {
    homeRate: rate * elecMult,
    workRate: (cat.fed.calculation_notes.commercial_rate_per_kwh?.current ?? utility.residential.flat_rate_per_kwh) * elecMult,
    meterAnnualUsd, elecMult, gasPrice: h.gasPrice,
    noHomeCharging: charging?.mode === "none",
  };
  const assignment = assign(units, uses, rates, opts.overrides, Y, cat.fed);
  const totalMiles = uses.reduce((s, u) => s + u.miles, 0);
  let upfrontCash = 0;
  let loan: LoanResult | null = null;
  let meterCharged = false;

  const unitResults: UnitResult[] = units.map((unit) => {
    const mine = uses.filter((u) => assignment[u.id] === unit.key);
    const miles = mine.reduce((s, u) => s + u.miles, 0);
    let energy = mine.reduce((s, u) => s + energyCost(unit, u, rates, cat.fed), 0);
    if (unit.pt !== "gas" && h.useTOU && !meterCharged && rates.meterAnnualUsd) {
      energy += rates.meterAnnualUsd; meterCharged = true;
    }
    const ownedIn = opts.owned.find((x) => x.key === unit.key);
    const maintenance = maintenanceFor(unit, miles, ownedIn?.odometer, own);
    // Premiums scale with value: a new one at list price, a used one at what
    // you pay for it, one you own at what it's worth.
    const insuredValue = unit.isNew
      ? (unit.usedOdometer ? opts.candidatePrice : null)
      : ownedIn?.valueNow ?? own.default_owned_value_usd;
    const insurance = insuranceFor(unit, insuredValue);
    const registration = registrationFor(unit, cat.fed);
    const runningPerYear = energy + maintenance + insurance + registration;

    let capitalOverPeriod = 0;
    let capitalNote = "";
    let interest = 0;
    if (unit.isNew) {
      const list = newVehiclePrice(unit);
      const price = opts.candidatePrice ?? list;
      const tradeIn = opts.soldKey ? opts.owned.find((o) => o.key === opts.soldKey)?.valueNow ?? 0 : 0;
      const taxBase = own.wv_purchase_tax.trade_in_reduces_base ? Math.max(0, price - tradeIn) : price;
      const tax = taxBase * own.wv_purchase_tax.rate + own.wv_purchase_tax.title_fee_usd;
      // New: resale is measured against LIST price (that's how retention
      // studies work) — a discount you negotiate lowers what you pay, not what
      // the car is worth later. The user's resale slider applies to new
      // plug-ins only. Used: it loses the used rate from what you pay.
      let resale: number;
      if (unit.usedOdometer) {
        resale = price * usedRetentionAfter(Y, own);
      } else {
        const r5 = unit.pt !== "gas" && h.retention5yOverride != null ? h.retention5yOverride : retention5(unit, opts.scenario, own);
        resale = list * retentionAfter(r5, Y, own);
      }
      const setup = unit.pt !== "gas" && charging ? charging.setupUsd : 0;
      // Paying monthly: the loan covers price + tax after the trade-in and
      // cash down; the home charger is paid in cash. Interest paid inside the
      // period is a real cost of buying this way, so it joins the total.
      const fin = h.financing;
      if (fin && fin.termMonths > 0) {
        const apr = unit.usedOdometer ? fin.aprUsed : fin.aprNew;
        const owed = Math.max(0, price + tax - tradeIn);
        const amount = Math.max(0, owed - fin.cashDown);
        interest = loanInterest(amount, apr, fin.termMonths, Y * 12);
        loan = { amount, payment: loanPayment(amount, apr, fin.termMonths), months: fin.termMonths, apr, cashAtSigning: Math.min(fin.cashDown, owed) + setup };
      }
      capitalOverPeriod = price + tax + setup - resale + interest;
      upfrontCash = price + tax + setup - tradeIn;
      const $ = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
      const priceNote = unit.usedOdometer ? " used" : destinationIsEstimated(unit) ? " (destination fee estimated)" : "";
      capitalNote = `${$(price)}${priceNote} + ${$(tax)} tax & title${setup ? ` + ${$(setup)} home charger` : ""}${interest ? ` + ~${$(interest)} loan interest` : ""} − ~${$(resale)} resale after ${Y} yr`;
    } else {
      const value = ownedIn?.valueNow ?? own.default_owned_value_usd;
      const later = value * Math.pow(1 - own.older_vehicle_annual_depreciation, Y);
      capitalOverPeriod = value - later;
      capitalNote = `Loses ~$${Math.round(capitalOverPeriod).toLocaleString("en-US")} of value over ${Y} yr`;
    }

    return {
      unit, miles, share: totalMiles ? miles / totalMiles : 0, uses: mine,
      energy, maintenance, insurance, registration, runningPerYear,
      capitalOverPeriod, capitalNote, interest,
    };
  });

  const runningPerYear = unitResults.reduce((s, r) => s + r.runningPerYear, 0);
  const capitalOverPeriod = unitResults.reduce((s, r) => s + r.capitalOverPeriod, 0);
  const totalOverPeriod = runningPerYear * Y + capitalOverPeriod;
  return {
    units: unitResults, assignment,
    unassigned: uses.filter((u) => !assignment[u.id]),
    runningPerYear, capitalOverPeriod, totalOverPeriod, perYear: totalOverPeriod / Y,
    upfrontCash, charging,
    interestOverPeriod: unitResults.reduce((s, r) => s + r.interest, 0), loan,
  };
}

// "What would a USED one need to cost?" Solve for the purchase price at which
// buying this model used makes the scenario's total equal `targetTotal`.
// A used vehicle (typically 2–4 years old) runs the same as new but is past
// its steepest drop: it loses used_vehicle_annual_depreciation a year from
// what you pay, and costs less to insure (premium scales with value) — the
// same math runScenario uses when you enter a used price, so planning with
// this price produces a tie. The planner caps the answer at the new price
// ("any price below new"). Returns null when even a free vehicle wouldn't
// get there.
export function usedBreakEvenPrice(scenario: ScenarioResult, targetTotal: number, h: HouseholdInput, cat: Catalog): number | null {
  const ur = scenario.units.find((u) => u.unit.isNew);
  if (!ur) return null;
  const Y = h.years;
  const own = cat.own;
  const setup = ur.unit.pt !== "gas" && scenario.charging ? scenario.charging.setupUsd : 0;
  // Everything except this vehicle's price, resale, tax and insurance.
  const fixed = scenario.totalOverPeriod - ur.capitalOverPeriod - ur.insurance * Y + setup;
  const keep = usedRetentionAfter(Y, own);
  const { rate, title_fee_usd: title, trade_in_reduces_base } = own.wv_purchase_tax;
  const sold = h.candidate?.replaces;
  const tradeIn = sold ? h.owned.find((o) => o.key === sold)?.valueNow ?? 0 : 0;
  const fin = h.financing;
  const total = (p: number) => {
    const taxBase = trade_in_reduces_base ? Math.max(0, p - tradeIn) : p;
    const tax = taxBase * rate + title;
    const ins = insuranceFor(ur.unit, p);
    // Financed the same way runScenario finances a used purchase.
    const interest = fin && fin.termMonths > 0 ? loanInterest(Math.max(0, Math.max(0, p + tax - tradeIn) - fin.cashDown), fin.aprUsed, fin.termMonths, Y * 12) : 0;
    return fixed + ins * Y + p + tax - keep * p + interest;
  };
  if (total(0) > targetTotal) return null;
  let lo = 0, hi = Math.max(1000, newVehiclePrice(ur.unit) * 3);
  if (total(hi) <= targetTotal) return hi;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (total(mid) <= targetTotal) lo = mid; else hi = mid;
  }
  return lo;
}

export interface PlanResult {
  uses: Use[];
  today: ScenarioResult;
  plan: ScenarioResult | null;
  planUnits: Unit[];
  gasAlt: ScenarioResult | null;
  gasAltUnits: Unit[];
  // Totals under the low and high resale scenarios (paired: EV and gas move together).
  range: { low: { plan: number | null; gasAlt: number | null }; high: { plan: number | null; gasAlt: number | null } };
}

function runAll(h: HouseholdInput, cat: Catalog, uses: Use[], scenario: ResaleScenario) {
  const ownedUnits = h.owned
    .map((o) => resolveUnit(o.ref, o.key, cat, o.mpgOverride))
    .filter((u): u is Unit => !!u);
  const base = { owned: h.owned, scenario };
  const today = runScenario(ownedUnits, uses, h, cat, { ...base, overrides: {}, soldKey: null, candidatePrice: null });
  const sold = h.candidate?.replaces ?? null;
  const withNew = (ref: string, price: number, overrides: Record<string, string>, used?: UsedPurchase | null) => {
    const unit = resolveUnit(ref, "new", cat, undefined, true, used?.odometer);
    if (!unit) return null;
    const units = [...ownedUnits.filter((u) => u.key !== sold), unit];
    return { units, result: runScenario(units, uses, h, cat, { ...base, overrides, soldKey: sold, candidatePrice: price }) };
  };
  const ev = h.candidate ? withNew(h.candidate.ref, h.candidate.price, h.overrides, h.candidate.used) : null;
  const gas = h.candidate && h.gasAlternative ? withNew(h.gasAlternative.ref, h.gasAlternative.price, {}, h.gasAlternative.used) : null;
  return { ownedUnits, today, ev, gas };
}

export function planHousehold(h: HouseholdInput, cat: Catalog): PlanResult {
  const uses = buildUses(h);
  const main = runAll(h, cat, uses, h.resaleScenario ?? "mid");
  const lo = runAll(h, cat, uses, "low");
  const hi = runAll(h, cat, uses, "high");
  return {
    uses, today: main.today,
    plan: main.ev?.result ?? null, planUnits: main.ev?.units ?? main.ownedUnits,
    gasAlt: main.gas?.result ?? null, gasAltUnits: main.gas?.units ?? [],
    range: {
      low: { plan: lo.ev?.result.totalOverPeriod ?? null, gasAlt: lo.gas?.result.totalOverPeriod ?? null },
      high: { plan: hi.ev?.result.totalOverPeriod ?? null, gasAlt: hi.gas?.result.totalOverPeriod ?? null },
    },
  };
}

// ---------- Used shopping list ----------

export interface UsedShoppingRow {
  vehicle: Vehicle;
  newPrice: number;            // list price new (last listed, if it's no longer sold new)
  maxUsedPrice: number | null; // most a used one could cost and still tie; null = not even free
  note: string | null;         // the one fit caveat worth knowing, if any
}

// One model per trim family (its primary trim), no cargo vans, and not the
// EV already being tried.
export function shoppingModels(cat: Catalog, tryingRef: string | null): Vehicle[] {
  const trying = cat.evs.find((v) => `ev:${v.id}` === tryingRef);
  const seen = new Set<string>();
  const primaryFirst = [...cat.evs].sort((a, b) => Number(!!b.variant_primary) - Number(!!a.variant_primary));
  const out: Vehicle[] = [];
  for (const v of primaryFirst) {
    if (v.class === "van") continue;
    if (trying && (v.id === trying.id || (!!v.variant_group && v.variant_group === trying.variant_group))) continue;
    if (v.variant_group) {
      if (seen.has(v.variant_group)) continue;
      seen.add(v.variant_group);
    }
    out.push(v);
  }
  return out;
}

// The caveat to show next to a model: a tight fit first, else the charging
// stops on the longest trip it would take.
function fitNote(unit: Unit, r: ScenarioResult, uses: Use[], years: number): string | null {
  const mine = uses.filter((u) => r.assignment[u.id] === unit.key).map((u) => ({ u, f: fit(unit, u, years) }));
  const tight = mine.find((x) => x.f.level === "tight");
  if (tight) return `${tight.u.label}: ${tight.f.text}`;
  const longest = mine.filter((x) => (x.f.dcfcStopsEachWay ?? 0) > 0).sort((a, b) => b.u.oneWayMi - a.u.oneWayMi)[0];
  if (!longest) return null;
  const n = longest.f.dcfcStopsEachWay ?? 0;
  return `${longest.u.label}: ${n} fast-charging stop${n > 1 ? "s" : ""} each way`;
}

// "Which used EVs would work for us, and what could we pay?" Each model takes
// the place of the EV being tried (same replaced vehicle, same drives), bought
// used with under 50,000 miles. Models that can't do every drive are counted,
// not listed. For the rest: the most a used one could cost and still come out
// ahead of the plan's comparison (the gas vehicle if chosen, else keeping what
// you have) — usedBreakEvenPrice, so planning a model at its number is a tie.
// No used prices are tracked; the visitor holds these up against listings.
export function usedShoppingList(h: HouseholdInput, cat: Catalog, models: Vehicle[]): { rows: UsedShoppingRow[]; cantFit: number } {
  if (!h.candidate) return { rows: [], cantFit: 0 };
  const uses = buildUses(h);
  const scenario = h.resaleScenario ?? "mid";
  const main = runAll(h, cat, uses, scenario);
  const target = (main.gas?.result ?? main.today).totalOverPeriod;
  const sold = h.candidate.replaces;
  const kept = main.ownedUnits.filter((u) => u.key !== sold);
  const rows: UsedShoppingRow[] = [];
  let cantFit = 0;
  for (const v of models) {
    const ref = `ev:${v.id}`;
    const unit = resolveUnit(ref, "new", cat, undefined, true, "under_50k");
    if (!unit) continue;
    const newPrice = newVehiclePrice(unit);
    const hh: HouseholdInput = { ...h, candidate: { ref, price: newPrice, replaces: sold, used: { odometer: "under_50k" } }, overrides: {} };
    const r = runScenario([...kept, unit], uses, hh, cat, { owned: h.owned, scenario, overrides: {}, soldKey: sold, candidatePrice: newPrice });
    if (r.unassigned.length) { cantFit++; continue; }
    rows.push({ vehicle: v, newPrice, maxUsedPrice: usedBreakEvenPrice(r, target, hh, cat), note: fitNote(unit, r, uses, h.years) });
  }
  return { rows, cantFit };
}

// ---------- Tipping points ----------

function bisect(f: (x: number) => number, lo: number, hi: number): number | null {
  const flo = f(lo), fhi = f(hi);
  if (Math.sign(flo) === Math.sign(fhi)) return null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(f(mid)) === Math.sign(flo)) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// The EV plan vs the new-gas alternative (or vs keeping what you have when no
// gas alternative is chosen): the resale share and the gas price at which the
// two cost the same. null = no crossover in a sensible range.
export function tippingPoints(h: HouseholdInput, cat: Catalog): { retention5: number | null; gasPrice: number | null } {
  const diff = (hh: HouseholdInput) => {
    const r = planHousehold(hh, cat);
    if (!r.plan) return NaN;
    const other = r.gasAlt ?? r.today;
    return r.plan.totalOverPeriod - other.totalOverPeriod; // > 0 = EV costs more
  };
  const retention5 = bisect((x) => diff({ ...h, retention5yOverride: x }), 0.2, 0.8);
  const gasPrice = bisect((x) => diff({ ...h, gasPrice: x }), 1.5, 9);
  return { retention5, gasPrice };
}
