// Typical WV figures quoted in prose (homepage chart, EV 101 pages), computed
// from the data files so every page says the same thing and stays current.

import { ANNUAL_WINTER_KWH_MULTIPLIER, CO2_KG_PER_GAL_GASOLINE, CO2_KG_PER_KWH_WV_GRID, ICE_WINTER_FUEL_MULTIPLIER } from "./calc";
import type { FederalData, Utility, Vehicle } from "./types";

export function typicalFigures(fed: FederalData, utilities: Utility[], evs: Vehicle[]) {
  const effs = evs
    .filter((v) => v.powertrain === "bev" && v.status === "current" && v.class !== "van")
    .map((v) => v.efficiency_kwh_per_100mi)
    .sort((a, b) => a - b);
  const medianKwhPer100 = effs[Math.floor(effs.length / 2)];
  const kwhPer100 = medianKwhPer100 * ANNUAL_WINTER_KWH_MULTIPLIER;
  const gasPrice = fed.calculation_notes.gas_price_outlook_per_gal?.mid ?? fed.calculation_notes.gas_price_baseline_per_gal.current;
  const gasToday = fed.calculation_notes.gas_price_baseline_per_gal.current;
  const rates = utilities.filter((u) => u.id !== "rural_coops").map((u) => u.residential.flat_rate_per_kwh);
  const homeLow = Math.min(...rates), homeHigh = Math.max(...rates);
  const homeRate = (homeLow + homeHigh) / 2;
  const dcfcRate = fed.calculation_notes.dcfc_rate_per_kwh?.current ?? 0.55;
  const mpg = 25;
  return {
    medianKwhPer100, milesPerKwh: 100 / medianKwhPer100,
    gasPrice, gasToday, homeRate, homeLow, homeHigh, dcfcRate, mpg,
    gasPer100: (100 / mpg) * ICE_WINTER_FUEL_MULTIPLIER * gasPrice,
    homePer100: kwhPer100 * homeRate,
    publicPer100: kwhPer100 * dcfcRate,
    // CO₂ per mile, WV grid (PJM/RFCW) vs gasoline.
    evCo2KgPerMi: (kwhPer100 / 100) * CO2_KG_PER_KWH_WV_GRID,
    gasCo2KgPerMi: (CO2_KG_PER_GAL_GASOLINE / mpg) * ICE_WINTER_FUEL_MULTIPLIER,
  };
}

export const $2 = (n: number) => "$" + n.toFixed(2);
export const $0 = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
