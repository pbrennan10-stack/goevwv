// Turns a plan (the state behind a /plan?h=… link) into the engine's input and
// the verdict the results page leads with. Pure functions, no React: the
// planner uses them on screen and the share-card image uses them on the
// server, so a shared link's preview shows the same numbers as the page.

import {
  DESTINATION_FALLBACK_USD,
  planHousehold,
  retention,
  shortName,
  type Catalog,
  type HouseholdInput,
  type PlanResult,
} from "./household";
import { decodeState, initialState, sanitizeLoaded, type PlanState } from "./planState";
import type { IceVehicle, Vehicle } from "./types";

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
// "an Equinox EV", "a used Equinox EV", "an Ioniq 5", "a Ute".
const withArticle = (name: string, cap = false) => {
  const an = /^[aeio]/i.test(name) || (/^u/i.test(name) && !/^u(s|n[i])/i.test(name));
  return `${an ? (cap ? "An" : "an") : cap ? "A" : "a"} ${name}`;
};

export interface DerivedPlan {
  cand: Vehicle | undefined;
  candName: string;
  defaultPrice: number;      // MSRP + destination
  newPrice: number;          // MSRP + destination, or the user's quote
  price: number | null;      // what you'd pay: new price, or the used price entered (null until it is)
  buyableGas: IceVehicle[];          // gas vehicles still sold new, for the comparison picker
  replacedRef: string | undefined;   // the owned vehicle the EV replaces
  autoGas: string | null;            // "auto" gas comparison: a new one of the replaced vehicle, when still sold
  gasRef: string | null;
  gasVehicle: IceVehicle | undefined;
  gasNewPrice: number;
  gasPrice: number | null;
  input: HouseholdInput;
  defaultRetention: number;
}

// The planner's state → the engine's input, resolving prices and the gas comparison.
export function derivePlan(s: PlanState, catalog: Catalog): DerivedPlan {
  const cand = catalog.evs.find((v) => `ev:${v.id}` === s.candRef);
  const defaultPrice = cand ? cand.msrp_usd + (cand.destination_usd ?? DESTINATION_FALLBACK_USD) : 0;
  const newPrice = s.priceOverride ?? defaultPrice;
  const candName = cand ? shortName(cand) : "EV";
  // Bought used: the price of the one you found, or null until you enter it —
  // then there's no plan yet rather than a guess.
  const price = s.candUsed ? s.candUsed.price : newPrice;

  const buyableGas = catalog.ice.filter((v) => v.new_status === "current" && v.new_msrp_usd);
  const replacedRef = s.owned.find((o) => o.key === s.replaces)?.ref;
  const autoGas = replacedRef && buyableGas.some((v) => `ice:${v.id}` === replacedRef) ? replacedRef : null;
  const gasRef = s.gasRef === "auto" ? autoGas : s.gasRef;
  const gasVehicle = gasRef ? buyableGas.find((v) => `ice:${v.id}` === gasRef) : undefined;
  const gasDefaultPrice = gasVehicle ? (gasVehicle.new_msrp_usd ?? 0) + (gasVehicle.new_destination_usd ?? DESTINATION_FALLBACK_USD) : 0;
  const gasNewPrice = s.gasPriceOverride ?? gasDefaultPrice;
  const gasPrice = s.gasUsed ? s.gasUsed.price : gasNewPrice;

  const input: HouseholdInput = {
    owned: s.owned,
    candidate: cand && price != null
      ? { ref: s.candRef, price, replaces: s.replaces, used: s.candUsed && { odometer: s.candUsed.odometer } }
      : null,
    gasAlternative: gasVehicle && gasPrice != null
      ? { ref: `ice:${gasVehicle.id}`, price: gasPrice, used: s.gasUsed && { odometer: s.gasUsed.odometer } }
      : null,
    drivers: s.drivers,
    errandsMiPerWeek: s.errandsMiPerWeek,
    errandsPeople: s.errandsPeople,
    trips: s.trips.filter((t) => t.on),
    utilityId: s.utilityId,
    useTOU: s.useTOU,
    gasPrice: s.gasPrice,
    years: s.years,
    overrides: s.overrides,
    retention5yOverride: s.retention5yOverride,
    homeCharging: s.homeCharging ?? "auto",
  };
  const defaultRetention = cand
    ? retention(cand.powertrain === "phev" ? "phev" : "bev", cand.class, 5, catalog.own)
    : 0.43;
  return { cand, candName, defaultPrice, newPrice, price, buyableGas, replacedRef, autoGas, gasRef, gasVehicle, gasNewPrice, gasPrice, input, defaultRetention };
}

// The verdict card's numbers. "Other" is what the EV is measured against: the
// gas vehicle when one is chosen, else keeping what you have. Signs: a
// positive saving means the EV comes out ahead.
export interface Verdict {
  evName: string;            // "Equinox EV" or "used Equinox EV"
  isUsed: boolean;
  years: number;
  vsGas: boolean;            // measured against a gas vehicle (else against keeping what you have)
  otherLabel: string;        // "a new CR-V" / "a used CR-V" / "keeping what you have"
  saving: number;            // over the period, middle estimate; > 0 = EV saves
  monthlyRunSaving: number;  // running costs per month; > 0 = EV cheaper to run
  upfront: number;           // cash up front for the EV plan
  priceGap: number | null;   // EV up front − gas up front (null without a gas vehicle)
  range: { lo: number; hi: number } | null;  // saving across weak…strong resale (null for a used EV)
  breakEvenYears: number | null;             // years for lower running costs to cover a higher price
  vsToday: { saving: number; monthlyRunSaving: number } | null;  // also vs keeping, when a gas vehicle is the main comparison
  tradesIn: boolean;         // an owned vehicle is sold toward the EV
  unassigned: string[];      // uses nothing in the plan can do
}

export function verdict(s: PlanState, d: Pick<DerivedPlan, "cand" | "candName" | "gasVehicle">, result: PlanResult): Verdict | null {
  const { plan, today, gasAlt } = result;
  if (!plan || !d.cand) return null;
  const isUsed = !!s.candUsed;
  const gasVehicle = gasAlt ? d.gasVehicle : undefined;
  const other = gasAlt && gasVehicle ? gasAlt : today;
  const vsGas = !!(gasAlt && gasVehicle);
  const otherLabel = gasVehicle ? `a ${s.gasUsed ? "used" : "new"} ${shortName(gasVehicle)}` : "keeping what you have";
  const evMinusOther = (planTotal: number | null, otherTotal: number | null) =>
    planTotal == null ? null : planTotal - (otherTotal ?? today.totalOverPeriod);
  const lowD = evMinusOther(result.range.low.plan, vsGas ? result.range.low.gasAlt : null);
  const highD = evMinusOther(result.range.high.plan, vsGas ? result.range.high.gasAlt : null);
  const range = !isUsed && lowD != null && highD != null ? { lo: Math.min(-lowD, -highD), hi: Math.max(-lowD, -highD) } : null;
  const priceGap = vsGas ? plan.upfrontCash - other.upfrontCash : null;
  const runVsOther = other.runningPerYear - plan.runningPerYear;
  const breakEvenYears = priceGap != null && priceGap > 0 && runVsOther > 0 ? priceGap / runVsOther : null;
  return {
    evName: isUsed ? `used ${d.candName}` : d.candName,
    isUsed,
    years: s.years,
    vsGas,
    otherLabel,
    saving: other.totalOverPeriod - plan.totalOverPeriod,
    monthlyRunSaving: runVsOther / 12,
    upfront: plan.upfrontCash,
    priceGap,
    range,
    breakEvenYears,
    vsToday: vsGas
      ? { saving: today.totalOverPeriod - plan.totalOverPeriod, monthlyRunSaving: (today.runningPerYear - plan.runningPerYear) / 12 }
      : null,
    tradesIn: s.replaces != null,
    unassigned: plan.unassigned.map((u) => u.label),
  };
}

// The up-front tile's second line: the gap to the gas vehicle, or what the figure covers.
export function upfrontWords(v: Verdict): string {
  if (v.priceGap != null) {
    return v.priceGap > 0 ? `${usd(v.priceGap)} more than ${v.otherLabel}` : v.priceGap < 0 ? `${usd(-v.priceGap)} less than ${v.otherLabel}` : `same as ${v.otherLabel}`;
  }
  return v.tradesIn ? "after your trade-in" : "price, tax and title";
}

// A link preview's title: the plan in one line.
export function shareTitle(v: Verdict): string {
  const amount = v.saving >= 0 ? `saves about ${usd(v.saving)}` : `costs about ${usd(-v.saving)} more`;
  return `${withArticle(v.evName, true)} ${amount} vs ${v.vsGas ? v.otherLabel : "keeping what you have"} over ${v.years} years`;
}

// The sentence the results page leads with (and the share text repeats).
export function verdictSentence(v: Verdict): string {
  const amount = v.saving >= 0 ? `saves about ${usd(v.saving)}` : `costs about ${usd(-v.saving)} more`;
  return v.vsGas
    ? `vs. ${v.otherLabel}: the ${v.evName} ${amount} over ${v.years} years`
    : `The ${v.evName} ${amount} than keeping what you have over ${v.years} years`;
}

// The "over N years" tile: the span across resale scenarios, or the single estimate.
export function rangeWords(v: Verdict): string {
  if (v.range) {
    const { lo, hi } = v.range;
    if (lo < 0 && hi > 0) return `from ${usd(-lo)} more to ${usd(hi)} saved`;
    return lo >= 0 ? `saves ${usd(lo)}–${usd(hi)}` : `costs ${usd(-hi)}–${usd(-lo)} more`;
  }
  return v.saving >= 0 ? `saves ${usd(v.saving)}` : `costs ${usd(-v.saving)} more`;
}

// One sentence for sharing: the plan, in plain words, with where it was made.
export function shareText(v: Verdict): string {
  const amount = v.saving >= 0 ? `saves about ${usd(v.saving)}` : `costs about ${usd(-v.saving)} more`;
  const vs = v.vsGas ? v.otherLabel : "keeping our current car";
  return `Our household plan: ${withArticle(v.evName)} ${amount} vs ${vs} over ${v.years} years in WV, purchase price and resale included.`;
}

// A shared link (the ?h= value) → its verdict, or null when the link has no
// finished plan (bad link, no vehicle, or a used price not yet entered).
export function verdictFromLink(h: string | null | undefined, catalog: Catalog): Verdict | null {
  if (!h || h.length > 6000) return null;
  const loaded = sanitizeLoaded(decodeState(h), catalog);
  if (!loaded) return null;
  const s: PlanState = { ...initialState(catalog), ...loaded };
  const d = derivePlan(s, catalog);
  if (!d.input.candidate) return null;
  return verdict(s, d, planHousehold(d.input, catalog));
}
