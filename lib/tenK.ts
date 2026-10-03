// The what-if behind /learn/ten-thousand-dollar-car: the planner's typical WV
// household replacing its gas car four ways — keep it, buy a new gas car, buy
// the cheapest new EV sold here, or buy a $10,000 EV like the ones sold in
// China. Same engine as /plan, so the numbers agree with the planner.

import { planHousehold, shortName, type Catalog, type ScenarioResult } from "./household";
import { defaultFinance, initialState } from "./planState";
import { derivePlan } from "./planVerdict";
import type { Vehicle } from "./types";

export const WHAT_IF_PRICE = 10000;

export interface WhatIfCase {
  key: "keep" | "gas" | "ev" | "tenk";
  label: string;
  detail: string;
  payment: number;          // per month; 0 when nothing is financed
  cashBack: number;         // when the trade-in is worth more than the car
  runningPerMonth: number;
  lostValuePerMonth: number; // price − resale (plus loan interest), spread over the period
  totalPerMonth: number;
  totalPerYear: number;
}

// The cheapest new fully electric vehicle in the catalog, by list price.
export function cheapestNewEv(cat: Catalog): Vehicle {
  const list = (v: Vehicle) => v.msrp_usd + (v.destination_usd ?? 1500);
  return cat.evs
    .filter((v) => v.powertrain === "bev" && (v.status ?? "current") === "current" && v.variant_primary !== false && v.class !== "van")
    .sort((a, b) => list(a) - list(b))[0];
}

// A car like `base` that lists for `price`: same efficiency, range and class,
// so only the price (and what follows from it — tax, insurance, resale) differs.
export function tenThousandDollarCar(base: Vehicle, price = WHAT_IF_PRICE): Vehicle {
  return { ...base, id: "what-if-10k", make: "A", model: `$${price.toLocaleString("en-US")} EV`, trim: "", msrp_usd: price, destination_usd: 0, status: "current", notes: "", features: undefined };
}

export function whatIfCases(cat: Catalog, price = WHAT_IF_PRICE): WhatIfCase[] {
  const cheap = cheapestNewEv(cat);
  const tenK = tenThousandDollarCar(cheap, price);
  const cat2: Catalog = { ...cat, evs: [...cat.evs, tenK] };
  const base = { ...initialState(cat2), finance: defaultFinance(cat2) };
  const run = (candRef: string) => planHousehold(derivePlan({ ...base, candRef, priceOverride: null }, cat2).input, cat2);
  const r1 = run(`ev:${cheap.id}`);
  const r2 = run(`ev:${tenK.id}`);
  const months = base.years * 12;
  const owned = cat.ice.find((v) => `ice:${v.id}` === base.owned[0].ref);
  const gas = derivePlan(base, cat2).gasVehicle;
  const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const row = (key: WhatIfCase["key"], label: string, detail: string, sc: ScenarioResult): WhatIfCase => ({
    key, label, detail,
    payment: sc.loan?.payment ?? 0,
    cashBack: Math.max(0, -sc.upfrontCash),
    runningPerMonth: sc.runningPerYear / 12,
    lostValuePerMonth: sc.capitalOverPeriod / months,
    totalPerMonth: sc.totalOverPeriod / months,
    totalPerYear: sc.perYear,
  });
  return [
    row("keep", "Keep the gas car you have", `A paid-off ${owned ? shortName(owned) : "gas car"} worth about ${usd(base.owned[0].valueNow)}`, r1.today),
    row("gas", `Buy a new ${gas ? shortName(gas) : "gas car"}`, gas ? `${usd((gas.new_msrp_usd ?? 0) + (gas.new_destination_usd ?? 1500))} with destination, trading in the old one` : "", r1.gasAlt ?? r1.today),
    row("ev", "Buy the cheapest new EV sold here", `${cheap.year} ${cheap.make} ${cheap.model}, ${usd(cheap.msrp_usd + (cheap.destination_usd ?? 1500))} with destination, trading in the old one`, r1.plan!),
    row("tenk", `Buy a ${usd(price)} EV`, `A car like the ${shortName(cheap)} that lists for ${usd(price)} — sold in China, not here`, r2.plan!),
  ];
}
