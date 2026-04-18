// Loads and validates the data files from /data at build time.
// These are read as plain filesystem reads from server components,
// so the data is baked into the server bundle (not re-read per request).

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { FederalData, IceVehicle, Utility, Vehicle } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

function readJson<T>(filename: string): T {
  const raw = fs.readFileSync(path.join(DATA_DIR, filename), "utf8");
  return JSON.parse(raw) as T;
}

function readYaml<T>(filename: string): T {
  const raw = fs.readFileSync(path.join(DATA_DIR, filename), "utf8");
  return yaml.load(raw) as T;
}

interface VehiclesFile {
  _meta: Record<string, unknown>;
  vehicles: Vehicle[];
}

export function getVehicles(): Vehicle[] {
  const data = readJson<VehiclesFile>("vehicles.json");
  return data.vehicles;
}

export function getVehicleById(id: string): Vehicle | undefined {
  return getVehicles().find((v) => v.id === id);
}

// utilities.yaml has top-level keys for each utility (aep, mon_power, ...)
// plus one non-utility key (wvpsc) we should exclude. We also model rural_coops
// as an aggregate with a generic fallback rate.
export function getUtilities(): Utility[] {
  const raw = readYaml<Record<string, any>>("utilities.yaml");
  const out: Utility[] = [];

  for (const [key, value] of Object.entries(raw)) {
    if (key === "wvpsc") continue;
    if (!value || typeof value !== "object") continue;

    // rural_coops has a slightly different shape (aggregate)
    if (key === "rural_coops") {
      const g = value.generic_fallback;
      if (!g) continue;
      out.push({
        id: key,
        name: value.name ?? "Rural Electric Cooperatives",
        service_area: value.service_area ?? "Rural WV",
        website: value.coops?.[0]?.website ?? "",
        residential: {
          flat_rate_per_kwh: g.flat_rate_per_kwh,
          monthly_customer_charge: 0,
          rate_notes: g.disclaimer ?? "Coop rates vary — contact your coop.",
          tou_available: false,
        },
        rebates: [],
      });
      continue;
    }

    if (!value.residential) continue;
    out.push({
      id: key,
      name: value.name,
      parent_company: value.parent_company,
      website: value.website,
      service_area: value.service_area,
      customer_service_phone: value.customer_service_phone,
      residential: value.residential,
      rebates: value.rebates ?? [],
      coverage_zip_prefixes: value.coverage_zip_prefixes,
    });
  }

  return out;
}

export function getUtilityById(id: string): Utility | undefined {
  return getUtilities().find((u) => u.id === id);
}

export function getFederalData(): FederalData {
  return readYaml<FederalData>("federal.yaml");
}

interface IceVehiclesFile {
  _meta: Record<string, unknown>;
  ice_vehicles: IceVehicle[];
}

export function getIceVehicles(): IceVehicle[] {
  const data = readJson<IceVehiclesFile>("ice_vehicles.json");
  return data.ice_vehicles;
}
