// Backup power from an EV during an outage, from data/backup_power.yaml.
// Three rungs, cheapest first: a household-style outlet on the vehicle
// (runs a fridge and lights, no install), a 240-volt outlet feeding a
// generator-style transfer switch (essential circuits), and full
// vehicle-to-home hardware (the whole panel, automatic). Used by
// /learn/power-outages, /ev/[id], and the planner's used shopping list.

import type { Features } from "./features";

export type BackupRung = "outlet" | "transfer_switch" | "v2h";

export interface BackupPathEntry {
  ids: string[];                 // vehicle ids in vehicles.json
  outlet?: string;               // transfer_switch: the 240-volt outlet
  kw_240v?: number;
  kw_total?: number;
  requires?: string;             // trim or option needed
  hookup?: string;               // how it connects to the house
  system?: string;               // v2h: the hardware
  kw?: number;                   // v2h: power to the home
  cost: string;
  availability?: string;
  maker_runtime_days?: Record<string, number>; // vehicle id -> maker's "up to N days" at typical use
  source: string;
  source_url?: string;
  retrieved: string;
  confidence: "verified" | "approximate";
}

export interface BackupPowerData {
  retrieved: string;
  typical_home_kwh_per_day: number;
  essentials_kwh_per_day: number;
  usable_share: number;          // of the battery: keeps driving range in reserve, covers inverter losses
  daily_kwh_source: string;
  daily_kwh_source_url?: string;
  daily_kwh_notes?: string;
  transfer_switch: BackupPathEntry[];
  v2h: BackupPathEntry[];
  utility_notes?: { utility: string; note: string; source: string; source_url?: string; confidence: "verified" | "approximate" }[];
}

export interface BackupOptions {
  outlet: boolean | null;                 // household-style outlet on the vehicle (null = not checked)
  transferSwitch: BackupPathEntry | null;
  v2h: BackupPathEntry | null;
  best: BackupRung | null;
}

export const RUNG_LABEL: Record<BackupRung, string> = {
  outlet: "Household outlet: runs a fridge and lights in an outage",
  transfer_switch: "240-volt outlet: can back up your house with a transfer switch",
  v2h: "Whole-home backup hardware available",
};

export const RUNG_SHORT: Record<BackupRung, string> = {
  outlet: "outlet power",
  transfer_switch: "house backup (transfer switch)",
  v2h: "whole-home backup",
};

export function backupOptions(vehicleId: string, features: Features | undefined, data: BackupPowerData): BackupOptions {
  const transferSwitch = data.transfer_switch.find((e) => e.ids.includes(vehicleId)) ?? null;
  const v2h = data.v2h.find((e) => e.ids.includes(vehicleId)) ?? null;
  // A 240-volt outlet implies household outlets too.
  const outlet = features?.power_outlet_v2l ?? (transferSwitch ? true : null);
  const best: BackupRung | null = v2h ? "v2h" : transferSwitch ? "transfer_switch" : outlet ? "outlet" : null;
  return { outlet, transferSwitch, v2h, best };
}

// Days a battery could run a home: usable energy over daily use. The maker's
// own "up to N days" figure wins when the data file has one.
export function backupDays(batteryKwh: number, dailyKwh: number, data: BackupPowerData): number {
  return (batteryKwh * data.usable_share) / dailyKwh;
}

export function makerDays(vehicleId: string, data: BackupPowerData): number | null {
  for (const e of [...data.transfer_switch, ...data.v2h]) {
    const d = e.maker_runtime_days?.[vehicleId];
    if (d != null) return d;
  }
  return null;
}

// "about 3 days", "about 3½ days", "about a day", "under a day".
export function fmtDays(d: number): string {
  if (d < 0.75) return "under a day";
  const half = Math.round(d * 2) / 2;
  if (half === 1) return "about a day";
  const whole = Math.floor(half);
  const frac = half - whole;
  return `about ${frac ? `${whole}½` : whole} days`;
}
