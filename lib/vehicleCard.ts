// What a vehicle guide page's link preview says: the figures the page itself
// leads with, from the same helpers, so the card and the page agree.

import { backupDays, backupOptions, fmtDays, makerDays, type BackupPowerData, RUNG_SHORT } from "./backup";
import { STATUS_LABEL, costPer100Mi, fmtCents, powertrainLabel } from "./scenario";
import { typicalFigures } from "./typical";
import type { FederalData, Utility, Vehicle } from "./types";

export interface VehicleCardFacts {
  title: string;                                      // "2027 Chevrolet Equinox EV"
  subtitle: string;                                   // "Electric SUV · 1LT FWD · from $34,995"
  tiles: { label: string; value: string; sub: string }[];
  note: string | null;                                // outage line, or the status when not sold new
  path: string;                                       // "goevwv.com/ev/<id>"
}

const CLASS_LABEL: Record<string, string> = { suv: "SUV", truck: "pickup", sedan: "sedan", hatchback: "hatchback", van: "cargo van" };

export function vehicleCardFacts(v: Vehicle, fed: FederalData, utilities: Utility[], evs: Vehicle[], backup: BackupPowerData): VehicleCardFacts {
  const aep = utilities.find((u) => u.id === "aep") ?? utilities[0];
  const tf = typicalFigures(fed, utilities, evs);
  const per100 = costPer100Mi(v, aep.residential.flat_rate_per_kwh);
  const gasSub = `vs ${fmtCents(tf.gasPer100)} on gas at ${tf.mpg} mpg`;
  const estimate = v.epa_rated === false;
  const tiles: VehicleCardFacts["tiles"] = [];
  if (v.powertrain === "bev") {
    if (v.winter_range_mi) tiles.push({ label: "WV winter range", value: `~${v.winter_range_mi} mi`, sub: v.epa_range_mi ? `${estimate ? "maker's estimate" : "EPA"} ${v.epa_range_mi} mi` : "cold-day estimate" });
    if (v.highway_range_mi) tiles.push({ label: "Highway at 70 mph", value: `~${v.highway_range_mi} mi`, sub: "sustained, with a buffer" });
    tiles.push({ label: "100 miles at home", value: fmtCents(per100), sub: gasSub });
  } else {
    if (v.epa_range_mi_electric) tiles.push({ label: "Electric range", value: `${v.epa_range_mi_electric} mi`, sub: estimate ? "maker's estimate" : "EPA, before the engine starts" });
    if (v.efficiency_mpg_hybrid) tiles.push({ label: "On gas", value: `${v.efficiency_mpg_hybrid} mpg`, sub: "hybrid mode" });
    else if (v.epa_range_mi_total) tiles.push({ label: "Total range", value: `${v.epa_range_mi_total} mi`, sub: "electric + gas" });
    tiles.push({ label: "100 electric miles at home", value: fmtCents(per100), sub: gasSub });
  }
  const power = backupOptions(v.id, v.features, backup);
  let note: string | null = null;
  if (power.best) {
    const days = v.battery_kwh != null ? makerDays(v.id, backup) ?? backupDays(v.battery_kwh, backup.essentials_kwh_per_day, backup) : null;
    note = days != null
      ? `In an outage: ${fmtDays(days)} of essentials from the battery · ${RUNG_SHORT[power.best]}`
      : `In an outage: ${RUNG_SHORT[power.best]}`;
  } else if (v.status && v.status !== "current") {
    note = STATUS_LABEL[v.status];
  }
  const price = `$${v.msrp_usd.toLocaleString("en-US")}`;
  const sold = v.status && v.status !== "current" ? (v.status === "discontinued" ? `last sold new at ${price}` : `from ${price}`) : `from ${price}`;
  return {
    title: `${v.year} ${v.make} ${v.model}`,
    // Long trim names (cargo vans list roof height and wheelbase) are left off.
    subtitle: `${powertrainLabel(v)} ${CLASS_LABEL[v.class] ?? v.class}${v.trim && v.trim.length <= 24 ? ` · ${v.trim}` : ""} · ${sold}`,
    tiles: tiles.slice(0, 3),
    note,
    path: `goevwv.com/ev/${v.id}`,
  };
}
