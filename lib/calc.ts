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
    case "suv":      return 2100;
    case "sedan":    return 1900;
    case "hatchback": return 1600;
    default:         return 2000;
  }
}

// EPA constants
const CO2_KG_PER_GAL_GASOLINE = 8.887; // EPA direct tailpipe CO2
// WV electric grid emissions factor — WV is ~90% coal-fired.
// Source: EIA State Electricity Profile for WV. This is rough and will update.
const CO2_KG_PER_KWH_WV_GRID = 0.67;

// Winter in WV effectively adds ~12% to annual kWh consumption for BEVs
// if we assume ~4 cold months with ~28% range loss on those months only.
// (0.28 * 4/12 = ~0.093, rounded up for HVAC and slower DCFC losses)
const ANNUAL_WINTER_KWH_MULTIPLIER = 1.12;

// -- Fueling / charging time constants --
const ICE_TANK_GAL = 14;           // US average passenger car tank
const ICE_FILLUP_MIN = 5;          // drive in, pump, pay, drive out
const EV_HOME_PLUG_MIN = 1.5;      // plug in + unplug (at home, passive)
const LONG_TRIP_ONE_WAY_MI = 200;  // WV → Pittsburgh / DC / Charlotte typical
const DCFC_DEFAULT_MIN = 30;       // 10→80% on a 50–150 kW charger (warm, unobstructed)

// Every DCFC stop has non-charging overhead the base "10→80%" spec ignores:
// walk to charger, plug in, authenticate, wait for session init, unplug, drive out.
// 4 min is conservative; real-world can be 5–8 min on older networks.
const DCFC_PER_STOP_OVERHEAD_MIN = 4;

// Cold-weather DCFC is slower because battery thermal management throttles the
// charge curve when the pack is below operating temp. Typically 20–40% slower
// across 4 cold WV months. Annualized: (4/12) × ~25% = ~8% longer on average.
// Only applied when winter derate toggle is ON (user controls this).
const DCFC_WINTER_TIME_MULTIPLIER = 1.08;

// DCFC stops charge 10%→80% SoC (past 80% the taper slows to a crawl), so each
// stop adds 70% of battery capacity. Fallback for vehicles missing battery_kwh.
const DCFC_STOP_SOC_FRACTION = 0.70;
const DCFC_FALLBACK_BATTERY_KWH = 60;

// Fallback DCFC rate if federal.yaml doesn't carry one. Matches Electrify
// America Pass (non-member) as of 2026-04-18.
const DCFC_FALLBACK_RATE_PER_KWH = 0.48;

function homeChargeSessions(daily_mi: number, days_per_week: number, range_mi: number): number {
  // Charge when battery drops below ~20% capacity (usable = 80% of rated range).
  const usable = Math.max(range_mi * 0.8, 1);
  const daysPerCharge = Math.max(1, Math.floor(usable / Math.max(daily_mi, 1)));
  return Math.ceil((days_per_week * 52) / daysPerCharge);
}

function dcfcStopsPerRoundTrip(highwayRangeMi: number, oneWayMi: number): number {
  // Counts *mid-route* DCFC stops needed to complete one leg, then × 2 for the
  // round trip (assumes destination has overnight charging — hotel L2, family
  // garage, Supercharger near hotel, etc.).
  //
  // Asymmetric usable windows matter:
  //   - First tank (home → first stop): 100% SOC → ~15% buffer = 85% usable
  //   - Subsequent DCFC stops top to 80% only (past 80% the taper is painful)
  //     → 80% → 15% buffer = 65% usable
  //
  // highwayRangeMi is the curated realistic sustained highway range at ~70 mph
  // (not EPA combined). This reflects aero drag at highway speeds, HVAC, WV
  // elevation, and — for Tesla specifically — empirical reports that EPA is
  // overstated more than for other brands.
  if (!highwayRangeMi || highwayRangeMi <= 0) return 0;
  if (!oneWayMi || oneWayMi <= 0) return 0;
  const firstSegMi = highwayRangeMi * 0.85;
  if (oneWayMi <= firstSegMi) return 0;
  const perStopMi = highwayRangeMi * 0.65;
  const stopsOneWay = Math.ceil((oneWayMi - firstSegMi) / perStopMi);
  return stopsOneWay * 2;
}

function annualMiles(daily: number, daysPerWeek: number): number {
  return daily * daysPerWeek * 52;
}

function effectiveRatePerKwh(
  utility: Utility,
  useTOU: boolean,
): { rate: number; mode: "flat" | "tou" } {
  const r = utility.residential;
  if (useTOU && r.tou_available && r.tou_schedule) {
    // Users who opt into TOU charge overnight (off-peak) by design — use 100% off-peak rate.
    return { rate: r.tou_schedule.off_peak_rate_per_kwh, mode: "tou" };
  }
  return { rate: r.flat_rate_per_kwh, mode: "flat" };
}

// At highway speeds above the EPA test (~55 mph), aerodynamic drag raises EV energy use.
// Drag force ∝ v², so energy/mile for the aero component ∝ v².
// At 55 mph, aero drag ≈ 40% of total highway energy on a typical EV;
// rolling resistance and accessories make up the rest (roughly constant per mile).
// Formula: multiplier = (1 - aeroFrac) + aeroFrac × (v/55)²
// Real-world validation (Model Y): +25% at 70 mph, +45% at 80 mph vs 55 mph.
function speedEfficiencyMultiplier(highway_avg_speed_mph: number): number {
  if (highway_avg_speed_mph <= 55) return 1.0;
  const aeroFrac = 0.40;
  return (1 - aeroFrac) + aeroFrac * Math.pow(highway_avg_speed_mph / 55, 2);
}

function blendedKwhPer100mi(
  vehicle: Vehicle,
  highway_fraction: number,
  highway_avg_speed_mph = 55,
): number {
  const city = vehicle.efficiency_kwh_per_100mi_city ?? vehicle.efficiency_kwh_per_100mi;
  const hwyEpa = vehicle.efficiency_kwh_per_100mi_highway ?? vehicle.efficiency_kwh_per_100mi;
  const hwy = hwyEpa * speedEfficiencyMultiplier(highway_avg_speed_mph);
  return (1 - highway_fraction) * city + highway_fraction * hwy;
}

function kwhPerYear(
  vehicle: Vehicle,
  miles: number,
  derate: boolean,
  highway_fraction: number,
  highway_avg_speed_mph = 55,
): number {
  const basePerMile = blendedKwhPer100mi(vehicle, highway_fraction, highway_avg_speed_mph) / 100;
  const annualMult = derate ? ANNUAL_WINTER_KWH_MULTIPLIER : 1.0;
  if (vehicle.powertrain === "phev") {
    const electricShare = 0.65;
    return miles * electricShare * basePerMile * annualMult;
  }
  return miles * basePerMile * annualMult;
}

// EV insurance estimates (WV full coverage, 35-45 yo clean record).
// BEVs cost ~15-25% more to insure than equivalent ICE due to higher repair/parts costs.
// PHEVs run ~10% cheaper than pure BEVs — smaller battery, established gas-drivetrain
// repair network, and the 2nd powertrain reduces severity of electric-system claims.
function evInsuranceEstimate(vehicle: Vehicle): number {
  let base: number;
  switch (vehicle.class) {
    case "truck":   base = 2100; break;
    case "suv":     base = 1750; break;
    case "minivan": base = 1600; break;
    default:        base = 1600; break; // sedan / hatchback
  }
  if (vehicle.powertrain === "phev") return Math.round(base * 0.90);
  return base;
}

// Extra kWh per year from climbing hills.
// On a round-trip commute the ascent one way is the descent the other way,
// so we multiply gain by 2. Regen recovers REGEN_EFFICIENCY of descent energy;
// the remainder is the net loss.
function elevationExtraKwhPerYear(
  vehicle: Vehicle,
  elevation_gain_m: number,
  trips_per_year: number,
): number {
  if (elevation_gain_m <= 0) return 0;
  const mass = vehicleMassKg(vehicle);
  const climbJoules = mass * 9.81 * elevation_gain_m; // per one-way trip
  const roundTripNet = climbJoules * 2 * (1 - REGEN_EFFICIENCY); // round trip, after regen
  return (roundTripNet / 3_600_000) * trips_per_year;
}

function gallonsPerYear(vehicle: Vehicle, miles: number): number {
  // Only PHEVs burn gas in our catalog on days the battery is empty (35% of miles).
  if (vehicle.powertrain !== "phev") return 0;
  const gasShare = 0.35;
  const mpg = vehicle.efficiency_mpg_hybrid ?? 35;
  return (miles * gasShare) / mpg;
}

function stateAnnualFee(
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
    vehicle.class === "suv" || vehicle.class === "truck" || vehicle.class === "minivan"
      ? fed.federal_ev_tax_credits.new_ev_credit.msrp_caps.suvs_trucks_vans
      : fed.federal_ev_tax_credits.new_ev_credit.msrp_caps.cars;
  if (vehicle.msrp_usd > msrpCap) return 0;
  return fed.federal_ev_tax_credits.new_ev_credit.max_amount_usd;
}

export function annualIceMaintenance(v: IceVehicle, annual_miles: number): MaintenanceCosts {
  const oil = v.maintenance.oil_change_usd * v.maintenance.oil_changes_per_year;
  const tires = (v.maintenance.tire_set_usd / v.maintenance.tire_life_miles) * annual_miles;
  const brakes = (v.maintenance.brake_service_usd / v.maintenance.brake_life_miles) * annual_miles;
  const misc = v.maintenance.misc_annual_usd;
  return { oil_usd: oil, tires_usd: tires, brakes_usd: brakes, misc_usd: misc, total_usd: oil + tires + brakes + misc };
}

export function annualEvMaintenance(vehicle: Vehicle, annual_miles: number): MaintenanceCosts {
  // Tires: similar to ICE but slightly shorter life due to regenerative torque
  // Brakes: ~70% cheaper because regen braking extends pad/rotor life 3-5x
  // No oil changes. Misc = cabin air filter + wiper fluid only.
  const isTruck = vehicle.class === "truck";
  const isSuv = vehicle.class === "suv" || vehicle.class === "minivan";
  const tireSet = isTruck ? 950 : isSuv ? 750 : 620;
  const tireMi = 48000;
  const brakeSvc = isTruck ? 280 : isSuv ? 200 : 160;
  const brakeMi = 100000;
  const misc = 100;
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
  const trips_per_year = input.days_per_week * 52;
  const highway_fraction = input.route?.highway_fraction ?? DEFAULT_HIGHWAY_FRACTION;
  const highway_avg_speed_mph = input.route?.highway_avg_speed_mph ?? 55;
  const elevation_gain_m = input.route?.elevation_gain_m ?? 0;
  const { rate, mode } = effectiveRatePerKwh(ctx.utility, input.use_tou);
  const dcfcRate =
    ctx.fed.calculation_notes.dcfc_rate_per_kwh?.current ?? DCFC_FALLBACK_RATE_PER_KWH;

  // Current ICE fueling time — use vehicle's actual tank size if known.
  // Fuel consumption is across all miles (commute + long trips).
  const currentTankGal = input.current.ice_vehicle?.tank_gallons ?? ICE_TANK_GAL;
  const currentFillups = miles / (Math.max(input.current.mpg, 1) * currentTankGal);
  const currentFuelingMin = currentFillups * ICE_FILLUP_MIN;

  // Current-car baseline — gas and CO₂ covers all annual miles
  const currentGallons = miles / Math.max(input.current.mpg, 1);
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
    const kwh = kwhPerYear(v, miles, input.apply_winter_derate, highway_fraction, highway_avg_speed_mph)
              + elevationExtraKwhPerYear(v, elevation_gain_m, trips_per_year);

    // Charging / fueling time + energy-split breakdown
    let homeChargeSess = 0;
    let dcfcStops = 0;
    let dcfcMin = 0;
    let dcfcKwh = 0;
    let dcfcCost = 0;
    let gasFillupsEv = 0;
    let gasFuelingMinEv = 0;
    const phevGas = gallonsPerYear(v, miles);
    const phevGasCost = phevGas * input.current.gas_price_per_gal;

    if (v.powertrain === "bev") {
      const dailyRange = v.epa_range_mi ?? 200;
      // DCFC math uses a curated realistic highway range. Fall back to
      // 80% of EPA for any BEV that hasn't been curated yet.
      const hwyRange = v.highway_range_mi ?? Math.round(dailyRange * 0.80);
      homeChargeSess = homeChargeSessions(input.daily_round_trip_mi, input.days_per_week, dailyRange);
      dcfcStops = dcfcStopsPerRoundTrip(hwyRange, oneWayLongTripMi) * input.long_trips_per_year;

      // Per-stop time: base 10→80% charge + fixed overhead (plug-in, auth,
      // unplug). Cold-weather bump applied when winter derate is on.
      const baseChargeMin = v.charging.dcfc_10_to_80_min ?? DCFC_DEFAULT_MIN;
      const winterMult = input.apply_winter_derate ? DCFC_WINTER_TIME_MULTIPLIER : 1.0;
      const perStopMin = baseChargeMin * winterMult + DCFC_PER_STOP_OVERHEAD_MIN;
      dcfcMin = dcfcStops * perStopMin;

      // DCFC energy: each stop replenishes ~70% of battery capacity (10→80% SoC).
      // Clamp to total annual kWh so DCFC never exceeds what the vehicle uses.
      const battery = v.battery_kwh ?? DCFC_FALLBACK_BATTERY_KWH;
      dcfcKwh = Math.min(kwh, dcfcStops * battery * DCFC_STOP_SOC_FRACTION);
      dcfcCost = dcfcKwh * dcfcRate;
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
    const homeEnergyCost = homeKwh * rate;
    const totalEnergyCost = homeEnergyCost + dcfcCost + phevGasCost;

    const fee = stateAnnualFee(v, ctx.fed);
    // Include EV maintenance + insurance only when ICE vehicle is selected (apples-to-apples)
    const evMaint = currentMaint ? annualEvMaintenance(v, miles) : null;
    const evMaintUsd = evMaint?.total_usd ?? 0;
    const evInsurance = currentMaint ? evInsuranceEstimate(v) : 0;
    const annualTotal = totalEnergyCost + fee.usd + evMaintUsd + evInsurance;
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
    if (mode === "tou" && ctx.utility.residential.tou_requires_separate_meter) {
      warnings.push(
        "This utility's EV TOU rate requires a separate meter install; factor in one-time cost.",
      );
    }

    return {
      vehicle: v,
      annual_miles: miles,
      annual_energy_cost_usd: totalEnergyCost,
      annual_state_fee_usd: fee.usd,
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
