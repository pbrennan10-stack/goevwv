// WV-specific EV total-cost-of-ownership math.
// Inputs are light intentionally; we show assumptions in the UI so
// users can see where the numbers come from.

import type {
  CalcInput,
  FederalData,
  Utility,
  Vehicle,
  VehicleResult,
} from "./types";

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

function kwhPerYear(vehicle: Vehicle, miles: number, derate: boolean): number {
  const basePerMile = vehicle.efficiency_kwh_per_100mi / 100;
  const annualMult = derate ? ANNUAL_WINTER_KWH_MULTIPLIER : 1.0;
  if (vehicle.powertrain === "phev") {
    // Assume 65% of miles on electric (real-world average per Argonne/INL studies).
    const electricShare = 0.65;
    return miles * electricShare * basePerMile * annualMult;
  }
  return miles * basePerMile * annualMult;
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
  // Simple heuristic: if the catalog marks it tax-credit-eligible, assume user
  // qualifies and claims the full $7,500 via point-of-sale. We show this as an
  // assumption in the UI and link to the IRS page.
  if (!vehicle.tax_credit_eligible) return 0;
  const msrpCap =
    vehicle.class === "suv" || vehicle.class === "truck" || vehicle.class === "minivan"
      ? fed.federal_ev_tax_credits.new_ev_credit.msrp_caps.suvs_trucks_vans
      : fed.federal_ev_tax_credits.new_ev_credit.msrp_caps.cars;
  if (vehicle.msrp_usd > msrpCap) return 0;
  return fed.federal_ev_tax_credits.new_ev_credit.max_amount_usd;
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
  current_annual_co2_kg: number;
  annual_miles: number;
}

export function calculate(input: CalcInput, ctx: CalcContext): CalcReturn {
  const miles = annualMiles(input.daily_round_trip_mi, input.days_per_week);
  const { rate, mode } = effectiveRatePerKwh(ctx.utility, input.use_tou);

  // Current-car baseline
  const currentGallons = miles / Math.max(input.current.mpg, 1);
  const currentGasCost = currentGallons * input.current.gas_price_per_gal;
  const currentCo2 = currentGallons * CO2_KG_PER_GAL_GASOLINE;

  const results: VehicleResult[] = ctx.vehicles.map((v) => {
    const kwh = kwhPerYear(v, miles, input.apply_winter_derate);
    const energyCost = kwh * rate;
    const phevGas = gallonsPerYear(v, miles);
    const phevGasCost = phevGas * input.current.gas_price_per_gal;
    const totalEnergyCost = energyCost + phevGasCost;

    const fee = stateAnnualFee(v, ctx.fed);
    const annualTotal = totalEnergyCost + fee.usd;
    const savings = currentGasCost - annualTotal;
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
    if (!v.tax_credit_eligible) {
      warnings.push(
        "Not eligible for the federal $7,500 IRA tax credit (manufacturing / battery sourcing rules).",
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
    current_annual_co2_kg: currentCo2,
    annual_miles: miles,
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
