// "What wears out" over an ownership period, gas vs EV, from data/wear_items.yaml.

export interface WearItem {
  item: string;
  applies_to: "gas" | "ev" | "both";
  interval_mi?: number;
  interval_years?: number;
  ev_interval_mi?: number;
  ev_interval_years?: number;
  cost_usd: number;
  ev_cost_usd?: number;
  note?: string;
}

export interface WearData {
  horizon_years: number;
  miles_per_year: number;
  items: WearItem[];
  sources: string[];
  battery: { warranty: string; fade_per_year_pct: number; sources: string[] };
}

export interface WearRow { item: string; note?: string; gas: { times: number; cost: number } | null; ev: { times: number; cost: number } | null }

function times(intervalMi: number | undefined, intervalYears: number | undefined, miles: number, years: number): number {
  if (intervalMi) return Math.floor(miles / intervalMi);
  if (intervalYears) return Math.floor(years / intervalYears);
  return 0;
}

export function wearOverPeriod(d: WearData, years = d.horizon_years, milesPerYear = d.miles_per_year): { rows: WearRow[]; gasTotal: number; evTotal: number } {
  const miles = years * milesPerYear;
  const rows: WearRow[] = d.items.map((it) => {
    const gasT = it.applies_to === "ev" ? null : times(it.interval_mi, it.interval_years, miles, years);
    const evT = it.applies_to === "gas" ? null : times(it.ev_interval_mi ?? it.interval_mi, it.ev_interval_years ?? it.interval_years, miles, years);
    return {
      item: it.item, note: it.note,
      gas: gasT == null ? null : { times: gasT, cost: gasT * it.cost_usd },
      ev: evT == null ? null : { times: evT, cost: evT * (it.ev_cost_usd ?? it.cost_usd) },
    };
  });
  return {
    rows,
    gasTotal: rows.reduce((s, r) => s + (r.gas?.cost ?? 0), 0),
    evTotal: rows.reduce((s, r) => s + (r.ev?.cost ?? 0), 0),
  };
}
