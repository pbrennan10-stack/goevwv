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

// How much of an EV owner's charging realistically happens on off-peak TOU.
// Industry studies (AEP, Xcel) show 70-85% with separate-meter EV rates.
const TOU_OFF_PEAK_SHARE = 0.75;

function annualMiles(daily: number, daysPerWeek: number): number {
  return daily * daysPerWeek * 52;
}

function effectiveRatePerKwh(
  utility: Utility,
  useTOU: boolean,
): { rate: number; mode: "flat" | "tou" } {
  const r = utility.residential;
  if (useTOU && r.tou_available && r.tou_schedule) {
    const tou = r.tou_schedule;
    const blended =
      TOU_OFF_PEAK_SHARE * tou.off_peak_rate_per_kwh +
      (1 - TOU_OFF_PEAK_SHARE) * tou.on_peak_rate_per_kwh;
    return { rate: blended, mode: "tou" };
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
// EVs cost ~15-25% more to insure than equivalent ICE due to higher repair/parts costs.
function evInsuranceEstimate(vehicle: Vehicle): number {
  switch (vehicle.class) {
    case "truck":   return 2100;
    case "suv":     return 1750;
    case "minivan": return 1600;
    default:        return 1600; // sedan / hatchback
  }
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
  current_annual_total_usd: number;        // gas + maintenance + insurance
  current_annual_co2_kg: number;
  annual_miles: number;
  highway_avg_speed_mph: number;           // for display in UI
}

export function calculate(input: CalcInput, ctx: CalcContext): CalcReturn {
  const miles = annualMiles(input.daily_round_trip_mi, input.days_per_week);
  const trips_per_year = input.days_per_week * 52;
  const highway_fraction = input.route?.highway_fraction ?? DEFAULT_HIGHWAY_FRACTION;
  const highway_avg_speed_mph = input.route?.highway_avg_speed_mph ?? 55;
  const elevation_gain_m = input.route?.elevation_gain_m ?? 0;
  const { rate, mode } = effectiveRatePerKwh(ctx.utility, input.use_tou);

  // Current-car baseline
  const currentGallons = miles / Math.max(input.current.mpg, 1);
  const currentGasCost = currentGallons * input.current.gas_price_per_gal;
  const currentCo2 = currentGallons * CO2_KG_PER_GAL_GASOLINE;
  const currentMaint = input.current.ice_vehicle
    ? annualIceMaintenance(input.current.ice_vehicle, miles)
    : null;
  const currentMaintUsd = currentMaint?.total_usd ?? 0;
  const currentInsuranceUsd = input.current.ice_vehicle?.annual_insurance_usd ?? 0;
  const currentTotalUsd = currentGasCost + currentMaintUsd + currentInsuranceUsd;

  const results: VehicleResult[] = ctx.vehicles.map((v) => {
    const kwh = kwhPerYear(v, miles, input.apply_winter_derate, highway_fraction, highway_avg_speed_mph)
              + elevationExtraKwhPerYear(v, elevation_gain_m, trips_per_year);
    const energyCost = kwh * rate;
    const phevGas = gallonsPerYear(v, miles);
    const phevGasCost = phevGas * input.current.gas_price_per_gal;
    const totalEnergyCost = energyCost + phevGasCost;

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
    if (v.epa_range_mi && v.epa_range_mi < input.daily_round_trip_mi * 1.5) {
      warnings.push(
        `Daily round-trip of ${input.daily_round_trip_mi} mi is close to the ${v.epa_range_mi}-mi EPA range — you'll want reliable home charging and a buffer.`,
      );
    }
    if (v.epa_range_mi && v.winter_range_mi && v.winter_range_mi < input.daily_round_trip_mi) {
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
    };
  });

  return {
    results,
    rate_mode: mode,
    rate_per_kwh: rate,
    current_annual_gas_cost: currentGasCost,
    current_annual_maintenance_usd: currentMaintUsd,
    current_annual_insurance_usd: currentInsuranceUsd,
    current_annual_total_usd: currentTotalUsd,
    current_annual_co2_kg: currentCo2,
    annual_miles: miles,
    highway_avg_speed_mph,
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
