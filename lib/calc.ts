// WV-specific EV total-cost-of-ownership math.
// Inputs are light intentionally; we show assumptions in the UI so
// users can see where the numbers come from.

import type {
  CalcInput,
  FederalData,
  IceVehicle,
  MaintenanceCosts,
  Utility,
  Vehicle,
  VehicleResult,
} from "./types";

// Regen braking recovers ~70% of descent energy on most modern EVs.
const REGEN_EFFICIENCY = 0.70;

// Default highway fraction when no route data is provided (EPA test is ~45% hwy).
const DEFAULT_HIGHWAY_FRACTION = 0.45;

// Estimated curb weight by vehicle class — used only for elevation energy math.
function vehicleMassKg(v: Vehicle): number {
  switch (v.class) {
    case "truck":    return 2800;
    case "van":      return 3200;
    case "suv":      return 2100;
    case "sedan":    return 1900;
    case "hatchback": return 1600;
    default:         return 2000;
  }
}

// EPA constants
export const CO2_KG_PER_GAL_GASOLINE = 8.887; // EPA direct tailpipe CO2
// Grid emissions factor for EV charging in WV. WV sits in the PJM grid and
// exports much of its coal power, so we use EPA eGRID's RFCW subregion rate
// (the grid WV homes actually draw from), consistent with EPA/DOE practice:
// eGRID2023 rev2 RFCW total output 926.6 lb CO2e/MWh + 4.2% grid losses
// = 0.439 kg/kWh. (EIA's WV in-state generation rate is 0.867 kg/kWh — a
// coal-only worst case.) Refreshed 2026-09-23.
export const CO2_KG_PER_KWH_WV_GRID = 0.44;

// WV winter, applied to BOTH sides so neither gets a one-sided penalty.
// EVs: ~28% range loss in ~4 cold months means 1/(1−0.28) − 1 ≈ 39% more kWh
// per mile in those months; averaged over the year: 1 + 0.389 × 4/12 ≈ 1.13.
export const ANNUAL_WINTER_KWH_MULTIPLIER = 1 + (1 / (1 - 0.28) - 1) * (4 / 12);
// Gas cars lose efficiency in the cold too. fueleconomy.gov: ~15% worse at
// 20°F for conventional cars vs ~39% for EVs (ratio 0.385). Scaling the site's
// 28% EV loss by that ratio → ~10.8% mpg loss in cold months ≈ +12% gallons ×
// 4/12 ≈ +4%/yr. Hybrids lose 30–34% in the cold → ~+8%/yr (also used for a
// PHEV's gas miles). Source: https://www.fueleconomy.gov/feg/coldweather.shtml
export const ICE_WINTER_FUEL_MULTIPLIER = 1.04;
export const HYBRID_WINTER_FUEL_MULTIPLIER = 1.08;

// Conventional hybrids (not plug-ins) are identified by their trim name.
export function isHybridTrim(trim: string | undefined | null): boolean {
  return !!trim && /hybrid/i.test(trim) && !/plug-?in/i.test(trim);
}

// Commute days: 50 working weeks a year (two weeks off). Shared by the
// calculator and the household planner so they agree.
export const WORK_WEEKS_PER_YEAR = 50;

// Plug-in hybrids keep a full engine (oil, filters, spark plugs, coolant) on
// top of EV parts. Consumer Reports: PHEVs cost ~1.4¢/mi more than BEVs at
// 0–50k mi (2026 dollars) ≈ $160/yr at 12k mi. Added to EV maintenance.
export const PHEV_MAINTENANCE_EXTRA_USD = 160;

// -- Fueling / charging time constants --
const ICE_TANK_GAL = 14;           // US average passenger car tank
const ICE_FILLUP_MIN = 5;          // drive in, pump, pay, drive out
const EV_HOME_PLUG_MIN = 1.5;      // plug in + unplug (at home, passive)
const LONG_TRIP_ONE_WAY_MI = 200;  // WV → Pittsburgh / DC / Charlotte typical
export const DCFC_DEFAULT_MIN = 30;       // 10→80% on a 50–150 kW charger (warm, unobstructed)

// Every DCFC stop has non-charging overhead the base "10→80%" spec ignores:
// walk to charger, plug in, authenticate, wait for session init, unplug, drive out.
// 4 min is conservative; real-world can be 5–8 min on older networks.
export const DCFC_PER_STOP_OVERHEAD_MIN = 4;

// Cold-weather DCFC is slower because battery thermal management throttles the
// charge curve when the pack is below operating temp. Typically 20–40% slower
// across 4 cold WV months. Annualized: (4/12) × ~25% = ~8% longer on average.
// Only applied when winter derate toggle is ON (user controls this).
export const DCFC_WINTER_TIME_MULTIPLIER = 1.08;

// DCFC stops charge 10%→80% SoC (past 80% the taper slows to a crawl), so each
// stop adds 70% of battery capacity. Fallback for vehicles missing battery_kwh.
export const DCFC_STOP_SOC_FRACTION = 0.70;
export const DCFC_FALLBACK_BATTERY_KWH = 60;

// Fallback DCFC rate if federal.yaml doesn't carry one. WV-area walk-up
// average as of 2026-09-23.
export const DCFC_FALLBACK_RATE_PER_KWH = 0.55;

function homeChargeSessions(daily_mi: number, days_per_week: number, range_mi: number): number {
  // Charge when battery drops below ~20% capacity (usable = 80% of rated range).
  const usable = Math.max(range_mi * 0.8, 1);
  const daysPerCharge = Math.max(1, Math.floor(usable / Math.max(daily_mi, 1)));
  return Math.ceil((days_per_week * WORK_WEEKS_PER_YEAR) / daysPerCharge);
}

export function dcfcStopsPerRoundTrip(
  highwayRangeMi: number,
  oneWayMi: number,
): { stops: number; extraMiRoundTrip: number } {
  // Counts *mid-route* DCFC stops needed to complete one leg, then × 2 for the
  // round trip (assumes destination has overnight charging — hotel L2, family
  // garage, Supercharger near hotel, etc.). Also returns the total miles that
  // must be DCFC-powered, so downstream time/cost scales to the actual energy
  // needed instead of assuming every stop is a full 10→80% fill. A real driver
  // tops off only enough to reach the next checkpoint plus buffer; modeling
  // every stop as 70% of battery capacity overstates both time and cost by
  // ~5× on borderline trips.
  //
  // Asymmetric usable windows matter:
  //   - First tank (home → first stop): 100% SOC → ~10% buffer = 90% usable
  //   - Subsequent DCFC stops top to 80% only (past 80% the taper is painful)
  //     → 80% → 10% buffer = 70% usable
  //
  // highwayRangeMi is the curated realistic sustained highway range at ~70 mph
  // (not EPA combined). This reflects aero drag at highway speeds, HVAC, WV
  // elevation, and — for Tesla specifically — empirical reports that EPA is
  // overstated more than for other brands.
  if (!highwayRangeMi || highwayRangeMi <= 0) return { stops: 0, extraMiRoundTrip: 0 };
  if (!oneWayMi || oneWayMi <= 0) return { stops: 0, extraMiRoundTrip: 0 };
  const firstSegMi = highwayRangeMi * 0.90;
  if (oneWayMi <= firstSegMi) return { stops: 0, extraMiRoundTrip: 0 };
  const perStopMi = highwayRangeMi * 0.70;
  const stopsOneWay = Math.ceil((oneWayMi - firstSegMi) / perStopMi);
  const extraMiOneWay = oneWayMi - firstSegMi;
  return { stops: stopsOneWay * 2, extraMiRoundTrip: extraMiOneWay * 2 };
}

function annualMiles(daily: number, daysPerWeek: number): number {
  return daily * daysPerWeek * WORK_WEEKS_PER_YEAR;
}

export function effectiveRatePerKwh(
  utility: Utility,
  useTOU: boolean,
): { rate: number; mode: "flat" | "tou"; meterAnnualUsd: number } {
  const r = utility.residential;
  if (useTOU && r.tou_available && r.tou_schedule) {
    // Users who opt into TOU charge overnight (off-peak) by design — use 100% off-peak rate.
    // Any monthly charge on the EV (sub)meter is added here; AEP/Wheeling's is $0.
    const meterAnnualUsd = (r.tou_monthly_meter_charge ?? 0) * 12;
    return { rate: r.tou_schedule.off_peak_rate_per_kwh, mode: "tou", meterAnnualUsd };
  }
  return { rate: r.flat_rate_per_kwh, mode: "flat", meterAnnualUsd: 0 };
}

// Above typical highway speeds, aerodynamic drag raises EV energy use
// (drag ∝ v², ~40% of highway energy is aero). The EPA highway label already
// includes a real-world adjustment (the 0.7 factor / 5-cycle tests), so it is
// treated as a ~65-mph figure, not a 55-mph one — only speeds ABOVE 65 add
// energy. (Gas cars also lose mpg at speed and aren't penalized here either;
// using a 65 baseline keeps the two sides comparable.)
// Formula: multiplier = (1 - aeroFrac) + aeroFrac × (v/65)²
function speedEfficiencyMultiplier(highway_avg_speed_mph: number): number {
  if (highway_avg_speed_mph <= 65) return 1.0;
  const aeroFrac = 0.40;
  return (1 - aeroFrac) + aeroFrac * Math.pow(highway_avg_speed_mph / 65, 2);
}

export function blendedKwhPer100mi(
  vehicle: Vehicle,
  highway_fraction: number,
  highway_avg_speed_mph = 55,
): number {
  const city = vehicle.efficiency_kwh_per_100mi_city ?? vehicle.efficiency_kwh_per_100mi;
  const hwyEpa = vehicle.efficiency_kwh_per_100mi_highway ?? vehicle.efficiency_kwh_per_100mi;
  const hwy = hwyEpa * speedEfficiencyMultiplier(highway_avg_speed_mph);
  return (1 - highway_fraction) * city + highway_fraction * hwy;
}

// Electric miles per year for a PHEV, assuming it's plugged in every night.
// Each commute day runs on electricity until the battery is empty, then on gas;
// each long road trip gets one battery's worth of electric miles (charged at
// home before leaving — PHEV owners rarely charge on the road). Winter derate
// shrinks usable electric range by the same factor it raises kWh per mile.
function phevElectricMiles(
  vehicle: Vehicle,
  daily_round_trip_mi: number,
  commute_days_per_year: number,
  long_trips_per_year: number,
  long_trip_one_way_mi: number,
  derate: boolean,
): number {
  if (vehicle.powertrain !== "phev") return 0;
  const annualMult = derate ? ANNUAL_WINTER_KWH_MULTIPLIER : 1.0;
  const eRange = (vehicle.epa_range_mi_electric ?? 0) / annualMult;
  const commuteElectric = Math.min(daily_round_trip_mi, eRange) * commute_days_per_year;
  const tripElectric = Math.min(long_trip_one_way_mi * 2, eRange) * long_trips_per_year;
  return commuteElectric + tripElectric;
}

function kwhPerYear(
  vehicle: Vehicle,
  miles: number, // for PHEVs, pass electric miles only
  derate: boolean,
  highway_fraction: number,
  highway_avg_speed_mph = 55,
): number {
  const basePerMile = blendedKwhPer100mi(vehicle, highway_fraction, highway_avg_speed_mph) / 100;
  const annualMult = derate ? ANNUAL_WINTER_KWH_MULTIPLIER : 1.0;
  return miles * basePerMile * annualMult;
}

// EV/PHEV insurance estimate (WV full coverage, 35-45 yo clean record).
// Roughly 40% of a full-coverage premium (liability) doesn't depend on the car;
// the other 60% (collision/comprehensive) scales with its value. Class bases are
// a typical WV premium at a reference price. Tesla, Rivian, Lucid and Polestar
// run ~25% higher (repair-network costs). 2026 sources: Insurify (new EVs in WV
// ~4% cheaper than new gas cars), ValuePenguin (legacy-brand EVs ≈ gas; Tesla/
// Rivian +48%), MoneyGeek WV (Model Y $2,747). Set 2026-09-23.
const INSURANCE_CLASS_BASE: Record<string, { usd: number; ref_msrp: number }> = {
  sedan:     { usd: 1650, ref_msrp: 30000 },
  hatchback: { usd: 1650, ref_msrp: 30000 },
  suv:       { usd: 1900, ref_msrp: 36000 },
  minivan:   { usd: 1800, ref_msrp: 42000 },
  truck:     { usd: 2000, ref_msrp: 52000 },
  // Cargo vans: personal-auto estimate at a work-van reference price. Business
  // (commercial auto) policies vary widely — treat as a rough placeholder.
  van:       { usd: 2100, ref_msrp: 55000 },
};
const INSURANCE_PREMIUM_BRANDS = new Set(["Tesla", "Rivian", "Lucid", "Polestar"]);
// Premium-repair-network brands cost more to insure. 1.15 (Sept 27 2026, was
// 1.25): gives Model Y ≈ $2,690 vs MoneyGeek WV $2,747, and R1S ≈ 2.1× an
// Equinox EV vs ValuePenguin's 2.11×. It's these brands, not EVs in general —
// Insurify finds WV EVs ~4% cheaper to insure than gas cars.
const PREMIUM_BRAND_INSURANCE_FACTOR = 1.15;

// Full-coverage premium for an EV/PHEV worth `value` (defaults to its MSRP).
// ~40% of a premium (liability) doesn't depend on the car; ~60% scales with
// its value — so a used or older car costs less to insure.
export function evInsuranceEstimate(vehicle: Vehicle, value = vehicle.msrp_usd): number {
  const base = INSURANCE_CLASS_BASE[vehicle.class] ?? INSURANCE_CLASS_BASE.sedan;
  const priceFactor = Math.min(1.8, Math.max(0.85, 0.40 + 0.60 * (value / base.ref_msrp)));
  const brandFactor = INSURANCE_PREMIUM_BRANDS.has(vehicle.make) ? PREMIUM_BRAND_INSURANCE_FACTOR : 1.0;
  return Math.round((base.usd * priceFactor * brandFactor) / 10) * 10;
}

// Same 40/60 idea for a car you already own: scale its new-car premium by
// what it's worth now. Never more than the new-car premium.
export function insuranceAtValue(newCarPremium: number, newPrice: number, value: number): number {
  if (!newPrice || newPrice <= 0) return newCarPremium;
  const factor = Math.min(1, 0.40 + 0.60 * (value / newPrice));
  return Math.round((newCarPremium * factor) / 10) * 10;
}

// Extra kWh per year from climbing hills. A round-trip commute climbs the
// net height difference once and descends it once. Climbing costs m·g·h at
// ~90% drivetrain efficiency (÷0.9); regen gets back ~70% on the way down.
// Net loss per round trip ≈ m·g·h × (1/0.9 − 0.7). (Gas cars recover nothing
// downhill, so this is not a penalty EVs pay that gas cars avoid.)
function elevationExtraKwhPerYear(
  vehicle: Vehicle,
  elevation_gain_m: number,
  trips_per_year: number,
): number {
  if (elevation_gain_m <= 0) return 0;
  const mass = vehicleMassKg(vehicle);
  const climbJoules = mass * 9.81 * elevation_gain_m;
  const roundTripNet = climbJoules * (1 / 0.9 - REGEN_EFFICIENCY);
  return (roundTripNet / 3_600_000) * trips_per_year;
}

export function gallonsPerYear(vehicle: Vehicle, gasMiles: number): number {
  // Only PHEVs burn gas in our catalog — the miles beyond each charge.
  if (vehicle.powertrain !== "phev") return 0;
  const mpg = vehicle.efficiency_mpg_hybrid ?? 35;
  return gasMiles / mpg;
}

// Public fast-charging price for this vehicle. Tesla owners pay close to the
// member rate on the Supercharger network; everyone else pays walk-up prices.
export function dcfcRateFor(v: Vehicle, fed: FederalData): number {
  const d = fed.calculation_notes.dcfc_rate_per_kwh;
  const walkUp = d?.current ?? DCFC_FALLBACK_RATE_PER_KWH;
  return v.make === "Tesla" && d?.member_rate ? d.member_rate : walkUp;
}

export function stateAnnualFee(
  vehicle: Vehicle,
  fed: FederalData,
): { usd: number; label: string } {
  if (vehicle.powertrain === "bev") {
    return {
      usd: fed.wv_state_fees.bev_annual_fee.amount_usd,
      label: "WV annual EV fee",
    };
  }
  if (vehicle.powertrain === "phev") {
    return {
      usd: fed.wv_state_fees.phev_annual_fee.amount_usd,
      label: "WV annual PHEV fee",
    };
  }
  return { usd: 0, label: "" };
}

function federalCredit(vehicle: Vehicle, fed: FederalData): number {
  if (fed.federal_ev_tax_credits.new_ev_credit.active === false) return 0;
  if (!vehicle.tax_credit_eligible) return 0;
  const msrpCap =
    vehicle.class === "suv" || vehicle.class === "truck" || vehicle.class === "minivan" || vehicle.class === "van"
      ? fed.federal_ev_tax_credits.new_ev_credit.msrp_caps.suvs_trucks_vans
      : fed.federal_ev_tax_credits.new_ev_credit.msrp_caps.cars;
  if (vehicle.msrp_usd > msrpCap) return 0;
  return fed.federal_ev_tax_credits.new_ev_credit.max_amount_usd;
}

// Oil changes follow the miles you drive: synthetic-oil intervals and oil-life
// monitors typically run 7,500–10,000 mi. At least one change a year (oil
// ages even when parked). Per-model intervals aren't verified, so one
// conservative interval is used for every gas vehicle.
export const OIL_CHANGE_INTERVAL_MI = 7500;

export function annualIceMaintenance(v: IceVehicle, annual_miles: number): MaintenanceCosts {
  const oil = v.maintenance.oil_change_usd * Math.max(1, annual_miles / OIL_CHANGE_INTERVAL_MI);
  const tires = (v.maintenance.tire_set_usd / v.maintenance.tire_life_miles) * annual_miles;
  const brakes = (v.maintenance.brake_service_usd / v.maintenance.brake_life_miles) * annual_miles;
  const misc = v.maintenance.misc_annual_usd;
  return { oil_usd: oil, tires_usd: tires, brakes_usd: brakes, misc_usd: misc, total_usd: oil + tires + brakes + misc };
}

export function annualEvMaintenance(vehicle: Vehicle, annual_miles: number): MaintenanceCosts {
  // Tires: EV-rated tires cost ~25–30% more and wear ~13% faster (weight, torque).
  // Brakes: regen does most of the stopping, so about one axle of pads per
  // 100k mi (RepairPal Sept 2026: EV axle job $432–489).
  // No oil changes. Misc ($215/yr, Sept 27 2026, was $115): cabin/HEPA filter,
  // 12V battery every 2–4 yrs (EVs wear them out sooner — Recurrent), brake
  // fluid, tire rotations, and brake caliper cleaning on WV salt roads.
  const isTruck = vehicle.class === "truck" || vehicle.class === "van";
  const isSuv = vehicle.class === "suv" || vehicle.class === "minivan";
  const tireSet = isTruck ? 1250 : isSuv ? 950 : 750;
  const tireMi = 48000;
  const brakeSvc = isTruck ? 600 : isSuv ? 460 : 430;
  const brakeMi = 100000;
  const misc = 215;
  const tires = (tireSet / tireMi) * annual_miles;
  const brakes = (brakeSvc / brakeMi) * annual_miles;
  return { oil_usd: 0, tires_usd: tires, brakes_usd: brakes, misc_usd: misc, total_usd: tires + brakes + misc };
}

export interface CalcContext {
  vehicles: Vehicle[];
  utility: Utility;
  fed: FederalData;
}

export interface CalcReturn {
  results: VehicleResult[];
  rate_mode: "flat" | "tou";
  rate_per_kwh: number;
  current_annual_gas_cost: number;
  current_annual_maintenance_usd: number;  // 0 when no ICE vehicle selected
  current_annual_insurance_usd: number;    // 0 when no ICE vehicle selected
  current_annual_registration_usd: number; // WV passenger vehicle registration fee
  current_annual_total_usd: number;        // gas + maintenance + insurance + registration
  current_annual_co2_kg: number;
  annual_miles: number;
  highway_avg_speed_mph: number;           // for display in UI
  current_annual_fillups: number;
  current_annual_fueling_min: number;
  long_trips_per_year: number;
  long_trip_one_way_mi: number;
}

export function calculate(input: CalcInput, ctx: CalcContext): CalcReturn {
  const commuteMi = annualMiles(input.daily_round_trip_mi, input.days_per_week);
  const oneWayLongTripMi = input.long_trip_one_way_mi ?? LONG_TRIP_ONE_WAY_MI;
  const longTripMi = input.long_trips_per_year * oneWayLongTripMi * 2;
  // Total annual miles includes both commute and long trips — this is what the
  // user actually drives in a year and what every fuel/energy figure scales on.
  const miles = commuteMi + longTripMi;
  const trips_per_year = input.days_per_week * WORK_WEEKS_PER_YEAR;
  const highway_fraction = input.route?.highway_fraction ?? DEFAULT_HIGHWAY_FRACTION;
  const highway_avg_speed_mph = input.route?.highway_avg_speed_mph ?? 55;
  const elevation_gain_m = input.route?.elevation_gain_m ?? 0;
  const { rate, mode, meterAnnualUsd } = effectiveRatePerKwh(ctx.utility, input.use_tou);
  // Winter hits gas cars too (see ICE_WINTER_FUEL_MULTIPLIER). The current car
  // is treated as a hybrid only when its catalog trim says so.
  const derate = input.apply_winter_derate;
  const currentWinterMult = !derate ? 1
    : isHybridTrim(input.current.ice_vehicle?.trim) ? HYBRID_WINTER_FUEL_MULTIPLIER
    : ICE_WINTER_FUEL_MULTIPLIER;

  // Current ICE fueling time — use vehicle's actual tank size if known.
  // Fuel consumption is across all miles (commute + long trips).
  const currentTankGal = input.current.ice_vehicle?.tank_gallons ?? ICE_TANK_GAL;
  const currentFillups = miles / (Math.max(input.current.mpg, 1) * currentTankGal);
  const currentFuelingMin = currentFillups * ICE_FILLUP_MIN;

  // Current-car baseline — gas and CO₂ covers all annual miles
  const currentGallons = (miles / Math.max(input.current.mpg, 1)) * currentWinterMult;
  const currentGasCost = currentGallons * input.current.gas_price_per_gal;
  const currentCo2 = currentGallons * CO2_KG_PER_GAL_GASOLINE;
  const currentMaint = input.current.ice_vehicle
    ? annualIceMaintenance(input.current.ice_vehicle, miles)
    : null;
  const currentMaintUsd = currentMaint?.total_usd ?? 0;
  const currentInsuranceUsd = input.current.ice_vehicle?.annual_insurance_usd ?? 0;
  // WV Class A passenger vehicle registration (separate from EV state fees).
  // Only charged if the user has picked a specific ICE vehicle — if they're
  // typing MPG manually without a vehicle, we don't know their situation.
  const currentRegUsd = input.current.ice_vehicle
    ? ctx.fed.wv_state_fees.standard_registration_fee?.amount_usd ?? 0
    : 0;
  const currentTotalUsd = currentGasCost + currentMaintUsd + currentInsuranceUsd + currentRegUsd;

  const results: VehicleResult[] = ctx.vehicles.map((v) => {
    const phevElecMi = phevElectricMiles(
      v, input.daily_round_trip_mi, trips_per_year, input.long_trips_per_year, oneWayLongTripMi,
      input.apply_winter_derate,
    );
    const electricMiles = v.powertrain === "phev" ? phevElecMi : miles;
    const kwh = kwhPerYear(v, electricMiles, input.apply_winter_derate, highway_fraction, highway_avg_speed_mph)
              + elevationExtraKwhPerYear(v, elevation_gain_m, trips_per_year);

    // Charging / fueling time + energy-split breakdown
    let homeChargeSess = 0;
    let dcfcStops = 0;
    let dcfcMin = 0;
    let dcfcKwh = 0;
    let dcfcCost = 0;
    let gasFillupsEv = 0;
    let gasFuelingMinEv = 0;
    const phevGas = gallonsPerYear(v, Math.max(0, miles - phevElecMi)) * (derate ? HYBRID_WINTER_FUEL_MULTIPLIER : 1);
    const phevGasCost = phevGas * input.current.gas_price_per_gal;
    const dcfcRate = dcfcRateFor(v, ctx.fed);

    if (v.powertrain === "bev") {
      const dailyRange = v.epa_range_mi ?? 200;
      // DCFC math uses a curated realistic highway range. Fall back to
      // 80% of EPA for any BEV that hasn't been curated yet.
      const hwyRange = v.highway_range_mi ?? Math.round(dailyRange * 0.80);
      homeChargeSess = homeChargeSessions(input.daily_round_trip_mi, input.days_per_week, dailyRange);

      const dcfcTrip = dcfcStopsPerRoundTrip(hwyRange, oneWayLongTripMi);
      dcfcStops = dcfcTrip.stops * input.long_trips_per_year;

      // DCFC energy scales to the miles that actually need DCFC power — the
      // overshoot beyond the first-leg-from-home window, both directions.
      // A driver who needs 15 mi of extra range tops off ~5 kWh, not a full
      // 10→80% fill. Clamp to total annual kWh so DCFC never exceeds total use.
      const battery = v.battery_kwh ?? DCFC_FALLBACK_BATTERY_KWH;
      const effKwhPerMi =
        (v.efficiency_kwh_per_100mi_highway ?? v.efficiency_kwh_per_100mi) / 100;
      const dcfcKwhPerRoundTrip = dcfcTrip.extraMiRoundTrip * effKwhPerMi;
      dcfcKwh = Math.min(kwh, dcfcKwhPerRoundTrip * input.long_trips_per_year);
      dcfcCost = dcfcKwh * dcfcRate;

      // Per-stop time: charging minutes scale with actual kWh delivered
      // (proportional to the published 10→80% window), plus fixed overhead per
      // stop. Cold-weather multiplier applies only to charging time, not the
      // human overhead of plugging in and authenticating.
      const baseChargeMin = v.charging.dcfc_10_to_80_min ?? DCFC_DEFAULT_MIN;
      const minPerKwh = baseChargeMin / (battery * DCFC_STOP_SOC_FRACTION);
      const winterMult = input.apply_winter_derate ? DCFC_WINTER_TIME_MULTIPLIER : 1.0;
      const chargingMin = dcfcKwh * minPerKwh * winterMult;
      const overheadMin = dcfcStops * DCFC_PER_STOP_OVERHEAD_MIN;
      dcfcMin = chargingMin + overheadMin;
    } else if (v.powertrain === "phev") {
      const eRange = v.epa_range_mi_electric ?? 40;
      homeChargeSess = homeChargeSessions(input.daily_round_trip_mi, input.days_per_week, eRange);
      // PHEVs use gas on long trips — no DCFC stops, but gas fill-ups from annual gas consumption
      gasFillupsEv = phevGas / ICE_TANK_GAL;
      gasFuelingMinEv = gasFillupsEv * ICE_FILLUP_MIN;
    }
    const homeChargeMin = homeChargeSess * EV_HOME_PLUG_MIN;

    // Energy cost split: home-rate kWh (everything that didn't go through DCFC)
    // plus DCFC-rate kWh for long-trip fast-charging stops.
    const homeKwh = Math.max(0, kwh - dcfcKwh);
    const homeEnergyCost = homeKwh * rate + meterAnnualUsd;
    const totalEnergyCost = homeEnergyCost + dcfcCost + phevGasCost;

    const fee = stateAnnualFee(v, ctx.fed);
    // Include EV maintenance + insurance only when ICE vehicle is selected (apples-to-apples)
    const evMaint = currentMaint ? annualEvMaintenance(v, miles) : null;
    const evMaintUsd = (evMaint?.total_usd ?? 0) + (evMaint && v.powertrain === "phev" ? PHEV_MAINTENANCE_EXTRA_USD : 0);
    const evInsurance = currentMaint ? evInsuranceEstimate(v) : 0;
    // The base WV registration applies to every car — add it to the EV side
    // whenever it's added to the gas side, so it never counts as a saving.
    const evFeeUsd = fee.usd + currentRegUsd;
    const annualTotal = totalEnergyCost + evFeeUsd + evMaintUsd + evInsurance;
    const savings = currentTotalUsd - annualTotal;
    const fiveYrOp = annualTotal * 5;
    const fiveYrSave = savings * 5;

    const credit = federalCredit(v, ctx.fed);
    const effectiveMsrp = v.msrp_usd - credit;

    const co2 =
      kwh * CO2_KG_PER_KWH_WV_GRID + phevGas * CO2_KG_PER_GAL_GASOLINE;
    const co2Saved = currentCo2 - co2;

    const warnings: string[] = [];
    if (v.epa_range_mi && input.daily_round_trip_mi > v.epa_range_mi) {
      warnings.push(
        `Daily round-trip of ${input.daily_round_trip_mi} mi EXCEEDS this vehicle's ${v.epa_range_mi}-mi EPA range. You can't do this commute on one charge — not viable unless you can reliably charge at your destination every day.`,
      );
    } else if (v.epa_range_mi && v.epa_range_mi < input.daily_round_trip_mi * 1.5) {
      warnings.push(
        `Daily round-trip of ${input.daily_round_trip_mi} mi is close to the ${v.epa_range_mi}-mi EPA range — you'll want reliable home charging and a buffer.`,
      );
    }
    if (
      v.epa_range_mi &&
      v.winter_range_mi &&
      v.winter_range_mi < input.daily_round_trip_mi &&
      input.daily_round_trip_mi <= v.epa_range_mi // already flagged above if exceeds EPA
    ) {
      warnings.push(
        `Estimated WV winter range (${v.winter_range_mi} mi) is less than your daily round trip. Plan for mid-day charging in January/February.`,
      );
    }
    if (v.powertrain === "phev" && v.epa_range_mi_electric && input.daily_round_trip_mi > v.epa_range_mi_electric) {
      warnings.push(
        `Your ${input.daily_round_trip_mi}-mi round trip is longer than this plug-in hybrid's ${v.epa_range_mi_electric}-mi electric range, so part of every commute runs on gas (about ${Math.round((miles > 0 ? electricMiles / miles : 0) * 100)}% of your miles on electricity).`,
      );
    }
    if (mode === "tou" && ctx.utility.residential.tou_requires_separate_meter) {
      warnings.push(
        meterAnnualUsd > 0
          ? `This utility's EV TOU rate requires a separate meter (one-time electrician cost) with its own ${fmtUSD(meterAnnualUsd / 12)}/month basic charge — included above. It only pays off if you charge a lot.`
          : "This utility's EV TOU rate requires an EV submeter installed by a licensed electrician — a one-time cost not included above.",
      );
    }

    return {
      vehicle: v,
      annual_miles: miles,
      annual_energy_cost_usd: totalEnergyCost,
      annual_state_fee_usd: evFeeUsd,
      annual_maintenance_usd: evMaintUsd,
      annual_insurance_usd: evInsurance,
      annual_total_usd: annualTotal,
      annual_savings_vs_current_usd: savings,
      five_year_operating_usd: fiveYrOp,
      five_year_savings_vs_current_usd: fiveYrSave,
      federal_credit_usd: credit,
      effective_msrp_usd: effectiveMsrp,
      kwh_per_year: kwh,
      co2_kg_per_year: co2,
      co2_saved_vs_current_kg_per_year: co2Saved,
      warnings,
      annual_home_charge_sessions: homeChargeSess,
      annual_home_charge_min: homeChargeMin,
      annual_dcfc_stops: dcfcStops,
      annual_dcfc_min: dcfcMin,
      annual_gas_fillups: gasFillupsEv,
      annual_gas_fueling_min: gasFuelingMinEv,
      annual_home_energy_cost_usd: homeEnergyCost,
      annual_dcfc_energy_cost_usd: dcfcCost,
      annual_phev_gas_cost_usd: phevGasCost,
      electric_share: miles > 0 ? electricMiles / miles : 0,
      annual_dcfc_kwh: dcfcKwh,
    };
  });

  return {
    results,
    rate_mode: mode,
    rate_per_kwh: rate,
    current_annual_gas_cost: currentGasCost,
    current_annual_maintenance_usd: currentMaintUsd,
    current_annual_insurance_usd: currentInsuranceUsd,
    current_annual_registration_usd: currentRegUsd,
    current_annual_total_usd: currentTotalUsd,
    current_annual_co2_kg: currentCo2,
    annual_miles: miles,
    highway_avg_speed_mph,
    current_annual_fillups: currentFillups,
    current_annual_fueling_min: currentFuelingMin,
    long_trips_per_year: input.long_trips_per_year,
    long_trip_one_way_mi: input.long_trip_one_way_mi ?? LONG_TRIP_ONE_WAY_MI,
  };
}

// Simple currency / number formatting helpers
export const fmtUSD = (n: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));

export const fmtUSDsigned = (n: number): string => {
  const s = fmtUSD(Math.abs(n));
  return n >= 0 ? `+${s}` : `-${s}`;
};

export const fmtNum = (n: number, decimals = 0): string =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
  }).format(n);
