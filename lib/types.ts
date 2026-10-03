import type { Features } from "./features";

// Shared types matching the shape of data/*.json and data/*.yaml

export type Powertrain = "bev" | "phev" | "hybrid" | "ice";
export type VehicleClass =
  | "sedan"
  | "suv"
  | "truck"
  | "hatchback"
  | "minivan"
  | "van"
  | "other";

// Seating, cargo, and towing — what the household planner checks a trip
// against. Cargo is split because one "cargo" number hides the question
// families actually ask ("does it fit 4 people AND the luggage?"):
//   cargo_behind_row2_cu_ft — rear cargo with the 2nd row up (3-row vehicles:
//                             3rd row folded). Sedans: trunk. null for pickups.
//   cargo_behind_row3_cu_ft — 3-row vehicles only, all seats up.
//   cargo_max_cu_ft         — all rear seats folded, excluding frunk.
//   subtrunk_cu_ft          — under-floor bin behind row 2; 0 = none, null = unknown.
//   row2_includes_subtrunk  — true when the row-2 figure already counts that bin
//                             (so it isn't added twice); null = can't tell.
//   frunk_cu_ft             — front trunk; 0 = none, null = has one, size unknown.
// Per-vehicle provenance lives in capability_source / capability_confidence.
export interface Capability {
  seats: number;
  cargo_behind_row2_cu_ft?: number | null;
  cargo_behind_row3_cu_ft?: number | null;
  cargo_max_cu_ft?: number | null;
  subtrunk_cu_ft?: number | null;
  row2_includes_subtrunk?: boolean | null;
  frunk_cu_ft?: number | null;
  bed_length_in?: number | null;
  towing_lbs?: number | null;
  payload_lbs?: number | null;
  capability_source?: string;
  capability_confidence?: "verified" | "approximate" | "unknown";
  capability_note?: string;
}

export interface Vehicle extends Capability {
  // Standard equipment on the priced trim (lib/features.ts).
  features?: Features;
  id: string;
  make: string;
  model: string;
  trim: string;
  year: number;
  class: VehicleClass;
  powertrain: Powertrain;
  msrp_usd: number;
  destination_usd?: number;
  // false = no EPA label (heavy vans, Escalade IQ, not-yet-rated models);
  // range/efficiency are the manufacturer's estimates.
  epa_rated?: boolean; // manufacturer destination/delivery charge, when known
  // BEV specs
  epa_range_mi?: number;
  winter_range_mi?: number;
  // Realistic sustained highway range at ~70 mph with some elevation + buffer.
  // Curated (not derived) because manufacturers' EPA inflation varies by brand —
  // Tesla in particular overstates more than most. WV-specific calibration.
  highway_range_mi?: number;
  // Some makers' EPA ratings are conservative. When at least two independent
  // tests (Edmunds, Consumer Reports, InsideEVs…) agree a model beats EPA,
  // real_world_range_factor holds the LOWEST matching tested/EPA ratio, and
  // winter_range_mi / efficiency figures in the data are already scaled by it.
  real_world_range_factor?: number;
  real_world_range_source?: string;
  efficiency_kwh_per_100mi: number;
  efficiency_kwh_per_100mi_city?: number;
  efficiency_kwh_per_100mi_highway?: number;
  battery_kwh?: number;
  // PHEV specs
  epa_range_mi_electric?: number;
  epa_range_mi_total?: number;
  winter_range_mi_electric?: number;
  efficiency_mpg_hybrid?: number;
  charging: {
    home_max_kw: number;
    dcfc_peak_kw: number;
    dcfc_10_to_80_min?: number;
    connector_home: string;
    connector_dcfc: string;
  };
  // Manufacturer-claimed 0-60 mph time in seconds. Independent testing
  // typically lands within ±0.3s. Shown inline on cards for quick scan.
  zero_to_sixty_s?: number;
  // Variant grouping — lets a single picker card represent multiple trims of
  // the same vehicle (Standard / Long Range / Performance, etc.) via a chip
  // toggle, instead of rendering every trim as its own card.
  //   variant_group   — shared identifier linking related trims
  //   variant_label   — short chip label ("Long Range", "⚡ Performance", etc.)
  //   variant_primary — true on the default trim shown in the picker; others
  //                     are reached via the chip toggle.
  variant_group?: string;
  variant_label?: string;
  variant_primary?: boolean;
  tax_credit_eligible: boolean;
  // NHTSA American Automobile Labeling Act (AALA) data
  us_canadian_parts_pct?: number | null; // null = AALA-exempt (GVWR > 8,500 lbs)
  assembly_location?: string;            // e.g. "Dearborn, MI" or "Cuautitlán, Mexico"
  assembly_country?: string;             // e.g. "US", "Canada", "Mexico", "South Korea"
  // current = sold new; final_year = last model year / production ended, new
  // inventory remains; discontinued = used market only (msrp_usd is last new price).
  status?: "current" | "final_year" | "discontinued";
  status_note?: string;
  notes: string;
}

export interface UtilityRebate {
  id: string;
  name: string;
  type: string;
  amount_usd: number | null;
  description: string;
  eligibility?: string[];
  url: string;
  expires: string | null;
  stackable_with_federal?: boolean;
}

export interface UtilityResidential {
  flat_rate_per_kwh: number;
  monthly_customer_charge: number;
  rate_notes: string;
  tou_available: boolean;
  tou_program_name?: string | null;
  tou_url?: string;
  tou_schedule?: {
    off_peak_hours: string;
    off_peak_rate_per_kwh: number;
    on_peak_rate_per_kwh: number;
  };
  tou_requires_separate_meter?: boolean;
  tou_monthly_meter_charge?: number; // basic charge on the separate EV meter, $/month
  tou_enrollment_notes?: string;
  tou_notes?: string;
}

export interface Utility {
  id: string; // synthetic; the YAML key becomes this
  name: string;
  parent_company?: string;
  website: string;
  service_area: string;
  customer_service_phone?: string;
  residential: UtilityResidential;
  rebates: UtilityRebate[];
  coverage_zip_prefixes?: string[];
}

export interface FederalData {
  federal_ev_tax_credits: {
    new_ev_credit: {
      active?: boolean;
      status_note?: string;
      max_amount_usd: number;
      income_caps: { single: number; head_of_household: number; joint: number };
      msrp_caps: { cars: number; suvs_trucks_vans: number };
      point_of_sale_option: boolean;
      url: string;
    };
    used_ev_credit: {
      active?: boolean;
      status_note?: string;
      max_amount_usd: number;
      structure: string;
      url: string;
    };
    refueling_property_credit: {
      residential: { max_amount_usd: number; structure: string };
    };
  };
  wv_state_fees: {
    bev_annual_fee: { amount_usd: number; description: string };
    phev_annual_fee: { amount_usd: number; description: string };
    standard_registration_fee?: { amount_usd: number; description: string };
  };
  calculation_notes: {
    winter_range_derating: { default_percent: number };
    gas_price_baseline_per_gal: {
      current: number;
      source: string;
      retrieved?: string;
      retrieved_label?: string;
    };
    gas_price_outlook_per_gal?: {
      low: number;
      mid: number;
      high: number;
      source: string;
      source_url?: string;
      retrieved?: string;
      notes?: string;
    };
    electricity_annual_increase?: number;
    // Average WV business (commercial) price — default for paid charging at work.
    commercial_rate_per_kwh?: {
      current: number;
      residential_for_comparison?: number;
      source: string;
      source_url?: string;
      retrieved?: string;
      notes?: string;
    };
    dcfc_rate_per_kwh?: {
      current: number;
      member_rate?: number;
      source: string;
      retrieved?: string;
      notes?: string;
    };
  };
}

// data/checklists.yaml — the few constants the /learn/checklists page quotes.
export interface ChecklistData {
  retrieved: string;
  electrical: {
    nec_edition: string;
    nec_effective: string;
    nec_source: string;
    nec_source_url?: string;
    continuous_load_share: number;   // a charger on an existing circuit is set to this share of the breaker rating
    dryer_circuit_amps: number;
    load_management_note: string;
    sources: string[];
  };
}

// Output of the TCO calculator, per vehicle
export interface VehicleResult {
  vehicle: Vehicle;
  annual_miles: number;
  annual_energy_cost_usd: number;
  annual_state_fee_usd: number;
  annual_maintenance_usd: number;    // EV maintenance (tires + brakes + misc, no oil)
  annual_insurance_usd: number;      // EV insurance estimate (0 when no ICE vehicle selected)
  annual_total_usd: number;          // energy + fee + maintenance + insurance
  annual_savings_vs_current_usd: number; // +ve = EV saves money (vs current total incl. maintenance + insurance)
  five_year_operating_usd: number;
  five_year_savings_vs_current_usd: number;
  federal_credit_usd: number;
  effective_msrp_usd: number;
  kwh_per_year: number;
  co2_kg_per_year: number;
  co2_saved_vs_current_kg_per_year: number;
  warnings: string[];
  // Fueling/charging time
  annual_home_charge_sessions: number;
  annual_home_charge_min: number;   // passive: plug in/out at home while parked
  annual_dcfc_stops: number;        // active: sitting at a public fast charger
  annual_dcfc_min: number;          // includes per-stop overhead + winter penalty
  annual_gas_fillups: number;       // 0 for BEV; gas portion fill-ups for PHEV
  annual_gas_fueling_min: number;   // 0 for BEV; gas portion station time for PHEV
  // Cost breakdown — separate so the UI can show DCFC as its own line
  annual_home_energy_cost_usd: number;   // commute + long-trip home charging
  annual_dcfc_energy_cost_usd: number;   // BEV long-trip fast charging
  annual_phev_gas_cost_usd: number;      // PHEV gas portion (commute + long-trip)
  annual_dcfc_kwh: number;               // for display / transparency
  electric_share: number;                // 1 for BEVs; PHEV share of miles on electricity
}

export interface IceVehicleMaintenance {
  oil_change_usd: number;
  oil_changes_per_year: number;
  tire_set_usd: number;
  tire_life_miles: number;
  brake_service_usd: number;
  brake_life_miles: number;
  misc_annual_usd: number;
}

export interface IceVehicle extends Partial<Capability> {
  features?: Features;
  // The same vehicle bought NEW today (current model year), for the planner's
  // "new EV vs new gas" comparison. Absent/discontinued = can't be bought new.
  new_model_year?: number;
  new_trim?: string;
  new_msrp_usd?: number | null;
  new_destination_usd?: number | null;
  new_mpg_combined?: number | null;
  new_status?: "current" | "discontinued";
  price_source?: string;
  price_confidence?: "verified" | "approximate";
  price_note?: string;
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  class: VehicleClass;
  mpg_combined: number;
  tank_gallons: number;
  annual_insurance_usd: number;
  maintenance: IceVehicleMaintenance;
}

export interface MaintenanceCosts {
  oil_usd: number;
  tires_usd: number;
  brakes_usd: number;
  misc_usd: number;
  total_usd: number;
}

export interface CurrentVehicleInput {
  mpg: number;
  gas_price_per_gal: number;
  ice_vehicle?: IceVehicle;
}

export interface RouteData {
  distance_mi: number;
  highway_fraction: number;        // 0–1
  highway_avg_speed_mph: number;   // distance-weighted avg speed on highway segments; 55 = EPA baseline
  elevation_gain_m: number;        // one-way absolute altitude difference in metres
  summary: string;                 // human-readable display string
}

export interface ChargingStation {
  city: string;
  network: string;
  stalls: number;
  kw: number;
  note?: string;
}

export interface CorridorGap {
  description: string;
  severity: "moderate" | "high";
  note?: string;
}

export interface ChargingCorridor {
  id: string;
  name: string;
  description: string;
  coverage: "good" | "moderate" | "thin";
  length_wv_mi: number;
  stations: ChargingStation[];
  gaps: CorridorGap[];
}

export interface NeviStatus {
  allocation_usd: number;
  allocation_note?: string;
  rfp_issued: boolean;
  rfp_expected?: string;
  current_phase?: string;
  stations_planned: number;
  estimated_stations_open: string;
  as_of?: string;
  source_url?: string;
  note: string;
}

export interface StatewideSummary {
  public_ports_approx: number;
  l2_ports_approx?: number;
  dcfc_ports_approx: number;
  dcfc_sites_approx: number;
  as_of: string;
  bev_registrations: number;
  phev_registrations?: number;
  bev_pct_of_vehicles: number;
  sources?: string[];
}

export interface ChargingInfraData {
  nevi_status: NeviStatus;
  statewide_summary: StatewideSummary;
  corridors: ChargingCorridor[];
  live_data_links: {
    plugshare: string;
    chargepoint: string;
    tesla_supercharger: string;
    note: string;
  };
}

export interface CalcInput {
  daily_round_trip_mi: number;
  days_per_week: number;
  utility_id: string;
  use_tou: boolean;
  current: CurrentVehicleInput;
  apply_winter_derate: boolean;
  vehicle_ids: string[];
  route?: RouteData;
  long_trips_per_year: number; // trips where one-way distance ≈ 200 mi, requiring DCFC
  long_trip_one_way_mi?: number; // default 200; user can override for route-specific analysis
  ownership_plan?: "replace" | "keep"; // default "replace"; "keep" = two-car household scenario
}
