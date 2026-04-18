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
  efficiency_kwh_per_100mi: number;
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
  };
  calculation_notes: {
    winter_range_derating: { default_percent: number };
    gas_price_baseline_per_gal: { current: number; source: string };
  };
}

// Output of the TCO calculator, per vehicle
export interface VehicleResult {
  vehicle: Vehicle;
  annual_miles: number;
  annual_energy_cost_usd: number;
  annual_state_fee_usd: number;
  annual_total_usd: number;
  annual_savings_vs_current_usd: number; // +ve = EV saves money
  five_year_operating_usd: number;
  five_year_savings_vs_current_usd: number;
  federal_credit_usd: number;
  effective_msrp_usd: number;
  kwh_per_year: number;
  co2_kg_per_year: number;
  co2_saved_vs_current_kg_per_year: number;
  warnings: string[];
}

export interface CurrentVehicleInput {
  mpg: number;
  gas_price_per_gal: number;
}

export interface CalcInput {
  daily_round_trip_mi: number;
  days_per_week: number;
  utility_id: string;
  use_tou: boolean;
  current: CurrentVehicleInput;
  apply_winter_derate: boolean;
  vehicle_ids: string[];
}
