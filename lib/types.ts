// Shared types matching the shape of data/*.json and data/*.yaml

export type Powertrain = "bev" | "phev" | "hybrid" | "ice";
export type VehicleClass =
  | "sedan"
  | "suv"
  | "truck"
  | "hatchback"
  | "minivan"
  | "other";

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  trim: string;
  year: number;
  class: VehicleClass;
  powertrain: Powertrain;
  msrp_usd: number;
  // BEV specs
  epa_range_mi?: number;
  winter_range_mi?: number;
  // Realistic sustained highway range at ~70 mph with some elevation + buffer.
  // Curated (not derived) because manufacturers' EPA inflation varies by brand —
  // Tesla in particular overstates more than most. WV-specific calibration.
  highway_range_mi?: number;
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
  seats: number;
  cargo_cu_ft?: number;
  payload_lbs?: number;
  towing_lbs?: number;
  tax_credit_eligible: boolean;
  // NHTSA American Automobile Labeling Act (AALA) data
  us_canadian_parts_pct?: number | null; // null = AALA-exempt (GVWR > 8,500 lbs)
  assembly_location?: string;            // e.g. "Dearborn, MI" or "Cuautitlán, Mexico"
  assembly_country?: string;             // e.g. "US", "Canada", "Mexico", "South Korea"
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
  verify_before_display?: boolean;
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
    gas_price_baseline_per_gal: { current: number; source: string };
    dcfc_rate_per_kwh?: { current: number; source: string; retrieved?: string; notes?: string };
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

export interface IceVehicle {
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
  stations_planned: number;
  estimated_stations_open: string;
  note: string;
}

export interface StatewideSummary {
  public_ports_approx: number;
  dcfc_approx: number;
  as_of: string;
  bev_registrations: number;
  bev_pct_of_vehicles: number;
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
