// Seating / cargo / towing helpers shared by the vehicle pages and (next)
// the household planner. See the Capability type in ./types for field meanings.

import type { Capability } from "./types";

const n1 = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

// Under-floor bin volume not already counted in the row-2 figure. When we
// can't tell whether it's included, assume it is (never double-count).
function extraSubtrunk(c: Capability): number {
  if (!c.subtrunk_cu_ft || c.row2_includes_subtrunk !== false) return 0;
  return c.subtrunk_cu_ft;
}

// Usable luggage space with every seat in use: rear cargo behind row 2, plus
// any sub-trunk not already in that figure, plus the front trunk. null when
// we don't know the rear figure (or it's a pickup).
export function cargoSeatsUp(c: Capability): number | null {
  if (c.cargo_behind_row2_cu_ft == null) return null;
  return c.cargo_behind_row2_cu_ft + extraSubtrunk(c) + (c.frunk_cu_ft ?? 0);
}

export function cargoSeatsUpLabel(c: Capability): string | null {
  if (c.bed_length_in) return `${n1(c.bed_length_in / 12)} ft bed`;
  const total = cargoSeatsUp(c);
  if (total == null) return null;
  const hidden = [
    extraSubtrunk(c) || c.row2_includes_subtrunk ? "sub-trunk" : "",
    c.frunk_cu_ft ? "frunk" : "",
  ].filter(Boolean);
  return `${n1(total)} cu ft${hidden.length ? ` incl. ${hidden.join(" + ")}` : ""}`;
}

export function capabilitySpecs(c: Capability): [string, string][] {
  const rows: [string, string][] = [["Seats", String(c.seats)]];
  if (c.bed_length_in) {
    rows.push(["Bed length", `${n1(c.bed_length_in / 12)} ft (${c.bed_length_in} in)`]);
  }
  if (c.cargo_behind_row3_cu_ft != null) {
    rows.push(["Cargo, all seats up", `${n1(c.cargo_behind_row3_cu_ft)} cu ft`]);
  }
  const sameCargo = c.cargo_behind_row2_cu_ft != null && c.cargo_behind_row2_cu_ft === c.cargo_max_cu_ft;
  if (sameCargo) {
    rows.push(["Cargo space", `${n1(c.cargo_behind_row2_cu_ft!)} cu ft`]);
  } else if (c.cargo_behind_row2_cu_ft != null) {
    rows.push([
      c.cargo_behind_row3_cu_ft != null ? "Cargo behind 2nd row" : "Cargo, seats up",
      `${n1(c.cargo_behind_row2_cu_ft)} cu ft${
        c.row2_includes_subtrunk && !c.subtrunk_cu_ft ? " (incl. under-floor well)" : ""
      }`,
    ]);
  }
  if (c.subtrunk_cu_ft) {
    rows.push([
      "Under-floor sub-trunk",
      `${n1(c.subtrunk_cu_ft)} cu ft${c.row2_includes_subtrunk ? " (included above)" : ""}`,
    ]);
  }
  if (c.frunk_cu_ft) rows.push(["Front trunk", `${n1(c.frunk_cu_ft)} cu ft`]);
  const total = cargoSeatsUp(c);
  if (total != null && (c.frunk_cu_ft || extraSubtrunk(c))) {
    rows.push(["Luggage space, every seat full", `${n1(total)} cu ft total`]);
  }
  if (c.cargo_max_cu_ft != null && !sameCargo) {
    rows.push(["Cargo, seats folded", `${n1(c.cargo_max_cu_ft)} cu ft`]);
  }
  if (c.towing_lbs === 0) rows.push(["Towing", "Not rated for towing"]);
  else if (c.towing_lbs) rows.push(["Towing", `${c.towing_lbs.toLocaleString("en-US")} lbs`]);
  if (c.payload_lbs) rows.push(["Payload", `${c.payload_lbs.toLocaleString("en-US")} lbs`]);
  return rows;
}

// "Cargo-miles per kWh": luggage space with every seat full × miles per kWh.
// The passenger-car cousin of freight's ton-miles per gallon — how much stuff
// a vehicle carries how far on the same electricity. Pickups (bed, no
// enclosed cargo figure) and vehicles without cargo data return null.
export function cargoMilesPerKwh(
  c: Capability & { efficiency_kwh_per_100mi: number; class?: string },
): number | null {
  if (c.class === "van") return null; // cargo vans are a different job; not scored against cars
  const cargo = cargoSeatsUp(c);
  if (cargo == null || !c.efficiency_kwh_per_100mi) return null;
  return cargo * (100 / c.efficiency_kwh_per_100mi);
}

// Index a set of raw scores so the median = 100.
export function medianIndex(values: (number | null)[]): (v: number | null) => number | null {
  const xs = values.filter((x): x is number => x != null).sort((a, b) => a - b);
  if (!xs.length) return () => null;
  const mid = xs.length / 2;
  const median = xs.length % 2 ? xs[Math.floor(mid)] : (xs[mid - 1] + xs[mid]) / 2;
  return (v) => (v == null ? null : Math.round((v / median) * 100));
}
