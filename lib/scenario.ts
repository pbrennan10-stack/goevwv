// "Typical WV driver" scenario used by the static guide pages (/ev/*,
// /utilities/*, /faq). These pages are for search visitors who haven't
// entered anything yet, so they show one clearly labelled example and link
// into the calculator for personal numbers. Keep these defaults in step with
// DEFAULT_INPUT in components/Calculator.tsx so the numbers match when a
// visitor clicks through.

import { calculate } from "./calc";
import type { CalcInput, FederalData, Utility, Vehicle } from "./types";

export const TYPICAL = {
  daily_round_trip_mi: 30,
  days_per_week: 5,
  long_trips_per_year: 4,
  long_trip_one_way_mi: 200,
  mpg: 25,
} as const;

export function typicalInput(
  fed: FederalData,
  utility_id: string,
  vehicle_ids: string[],
): CalcInput {
  return {
    daily_round_trip_mi: TYPICAL.daily_round_trip_mi,
    days_per_week: TYPICAL.days_per_week,
    utility_id,
    use_tou: false,
    current: {
      mpg: TYPICAL.mpg,
      gas_price_per_gal: fed.calculation_notes.gas_price_baseline_per_gal.current,
    },
    apply_winter_derate: true,
    long_trips_per_year: TYPICAL.long_trips_per_year,
    long_trip_one_way_mi: TYPICAL.long_trip_one_way_mi,
    vehicle_ids,
  };
}

export function typicalScenario(
  vehicles: Vehicle[],
  utility: Utility,
  fed: FederalData,
) {
  return calculate(
    typicalInput(fed, utility.id, vehicles.map((v) => v.id)),
    { vehicles, utility, fed },
  );
}

// Link into the calculator pre-filled with the typical scenario.
export function calculatorHref(vehicleIds: string[], utilityId = "aep"): string {
  const p = new URLSearchParams({
    mi: String(TYPICAL.daily_round_trip_mi),
    d: String(TYPICAL.days_per_week),
    u: utilityId,
    mpg: String(TYPICAL.mpg),
    v: vehicleIds.join(","),
  });
  return `/calculator?${p.toString()}`;
}

// Home-charging cost per 100 miles at a given $/kWh, including the winter
// penalty averaged over the year (matches the calculator's 12% derate).
export function costPer100Mi(v: Vehicle, ratePerKwh: number): number {
  return (v.efficiency_kwh_per_100mi * 1.12) * ratePerKwh;
}

export function vehicleName(v: Vehicle): string {
  return `${v.make} ${v.model}${v.trim ? ` ${v.trim}` : ""}`;
}

export function powertrainLabel(v: Vehicle): string {
  return v.powertrain === "phev" ? "Plug-in hybrid" : "Electric";
}

export const STATUS_LABEL: Record<string, string> = {
  current: "On sale new",
  final_year: "Final model year — new inventory remains",
  discontinued: "Discontinued — used market only",
};

// Dollars and cents, for small figures like gas price or cost per 100 miles
// where fmtUSD's whole-dollar rounding hides the difference.
export const fmtCents = (n: number): string => `$${n.toFixed(2)}`;
