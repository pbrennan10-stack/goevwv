// Standard equipment on the specific trim we price (vehicles.json /
// ice_vehicles.json `features`). Facts only, no dollar values. Researched with
// AI assistance and second-checked against maker spec pages or dealer trim
// guides (Sept 2026); `confidence` says which. null = not confirmed.

export type DriverAssistLevel = "none" | "basic_adas" | "lane_centering" | "hands_free_highway" | "unknown";

export interface Features {
  driver_assist_level: DriverAssistLevel;
  driver_assist_name?: string | null;
  aeb?: boolean | null;
  blind_spot?: boolean | null;
  rear_cross_traffic?: boolean | null;
  lane_keep?: boolean | null;
  ota_updates?: "vehicle_systems" | "infotainment_only" | "none" | "unknown";
  heat_pump?: boolean | null;
  one_pedal?: boolean | null;
  remote_climate?: boolean | null;
  power_outlet_v2l?: boolean | null;
  heated_front_seats?: boolean | null;
  heated_steering_wheel?: boolean | null;
  power_liftgate?: boolean | null;
  surround_view_camera?: boolean | null;
  wireless_phone_projection?: boolean | null;
  main_screen_in?: number | null;
  source?: string;
  confidence?: "verified" | "approximate";
  note?: string;
}

export const ASSIST_LABEL: Record<DriverAssistLevel, string> = {
  hands_free_highway: "Hands-free on the highway",
  lane_centering: "Steers and keeps pace on the highway (hands on the wheel)",
  basic_adas: "Warnings and emergency braking — no steering help",
  none: "No driver-assist features standard",
  unknown: "Not confirmed",
};

export type FeatureKey = Exclude<keyof Features, "driver_assist_level" | "driver_assist_name" | "source" | "confidence" | "note" | "ota_updates" | "main_screen_in">;

export const FEATURE_GROUPS: { title: string; rows: { key: FeatureKey; label: string; evOnly?: boolean }[] }[] = [
  {
    title: "Safety",
    rows: [
      { key: "aeb", label: "Automatic emergency braking" },
      { key: "blind_spot", label: "Blind-spot warning" },
      { key: "rear_cross_traffic", label: "Rear cross-traffic alert" },
      { key: "lane_keep", label: "Lane-keeping assist" },
      { key: "surround_view_camera", label: "360° camera" },
    ],
  },
  {
    title: "Winter comfort",
    rows: [
      { key: "heated_front_seats", label: "Heated front seats" },
      { key: "heated_steering_wheel", label: "Heated steering wheel" },
      { key: "remote_climate", label: "Remote start or pre-heat" },
      { key: "heat_pump", label: "Heat pump (keeps more winter range)", evOnly: true },
    ],
  },
  {
    title: "Convenience",
    rows: [
      { key: "wireless_phone_projection", label: "Wireless CarPlay / Android Auto" },
      { key: "power_liftgate", label: "Power liftgate" },
      { key: "power_outlet_v2l", label: "Household-style power outlet" },
      { key: "one_pedal", label: "One-pedal driving", evOnly: true },
    ],
  },
];

export const OTA_LABEL: Record<NonNullable<Features["ota_updates"]>, string> = {
  vehicle_systems: "Whole car",
  infotainment_only: "Screen and maps only",
  none: "None",
  unknown: "Not confirmed",
};

// Rows worth showing for this vehicle. Power liftgate left null usually means
// "doesn't have a liftgate" (sedans, pickups), so it's dropped rather than
// shown as unconfirmed.
export function visibleRows(f: Features, isEv: boolean) {
  return FEATURE_GROUPS.map((g) => ({
    title: g.title,
    rows: g.rows.filter((r) => (isEv || !r.evOnly) && !(r.key === "power_liftgate" && f.power_liftgate == null)),
  }));
}

export function countStandard(f: Features, isEv: boolean): number {
  return visibleRows(f, isEv).flatMap((g) => g.rows).filter((r) => f[r.key] === true).length;
}
