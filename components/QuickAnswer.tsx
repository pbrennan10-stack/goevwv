"use client";

// Homepage quick answer: four plain questions → an honest verdict with a
// range, then a hand-off into the full planner already filled in. Uses the
// same engine as /plan (lib/household.ts), so the numbers match.

import Link from "next/link";
import { useMemo, useState } from "react";
import { SavingsRange } from "@/components/charts";
import { planHousehold, type Catalog, type HomeCharging, type HouseholdInput } from "@/lib/household";
import { TRIP_PRESETS, encodeState, gasOutlook, type PlanState } from "@/lib/planState";
import type { Vehicle } from "@/lib/types";

const usd = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;

type Parking = "garage" | "driveway" | "street";
type Kind = "car" | "suv" | "big" | "pickup";
type Trips = "rare" | "several" | "tow";

const KINDS: { v: Kind; label: string; ref: string }[] = [
  { v: "car", label: "A car", ref: "ice:toyota-camry-2024" },
  { v: "suv", label: "An SUV or crossover", ref: "ice:honda-crv-2024" },
  { v: "big", label: "A minivan or 3-row SUV", ref: "ice:honda-odyssey-2024" },
  { v: "pickup", label: "A pickup truck", ref: "ice:chevy-silverado-2024" },
];
const COMMUTES = [
  { v: 0, label: "I don't commute" },
  { v: 10, label: "Under 15 miles" },
  { v: 25, label: "15 to 35 miles" },
  { v: 45, label: "35 to 60 miles" },
  { v: 70, label: "Over 60 miles" },
];

function evFitsKind(v: Vehicle, kind: Kind): boolean {
  if (v.powertrain !== "bev" || v.status !== "current") return false;
  if (kind === "car") return v.class === "sedan" || v.class === "hatchback";
  if (kind === "suv") return v.class === "suv" && v.seats <= 5;
  if (kind === "big") return (v.class === "suv" || v.class === "minivan") && v.seats >= 6;
  return v.class === "truck";
}

export function QuickAnswer({ catalog }: { catalog: Catalog }) {
  const [parking, setParking] = useState<Parking | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [commute, setCommute] = useState<number | null>(null);
  const [trips, setTrips] = useState<Trips | null>(null);
  const [utilityId, setUtilityId] = useState("aep");
  const step = parking == null ? 0 : kind == null ? 1 : commute == null ? 2 : trips == null ? 3 : 4;

  const answer = useMemo(() => {
    if (step < 4 || !kind || commute == null || !trips || !parking) return null;
    const own = catalog.own;
    const gasRef = KINDS.find((k) => k.v === kind)!.ref;
    const gas = catalog.ice.find((v) => `ice:${v.id}` === gasRef);
    if (!gas) return null;
    const gasPrice = (gas.new_msrp_usd ?? 0) + (gas.new_destination_usd ?? 1500);
    const tripList = TRIP_PRESETS.map((t) => {
      if (t.id === "family") return { ...t, on: true, perYear: trips === "several" ? 6 : 2 };
      if (t.id === "beach") return { ...t, on: trips === "several", luggageCuFt: 20 };
      if (t.id === "tow") return { ...t, on: trips === "tow", towLbs: Math.min(5000, gas.towing_lbs ?? 5000) };
      return { ...t, on: false };
    });
    const homeCharging: HomeCharging = parking === "street" ? "none" : "auto";
    const base: Omit<HouseholdInput, "candidate"> = {
      owned: [{ key: "a", ref: gasRef, valueNow: own.default_owned_value_usd }],
      gasAlternative: { ref: gasRef, price: gasPrice },
      drivers: [{ id: 1, commuteOneWayMi: commute, daysPerWeek: commute ? 5 : 0 }],
      errandsMiPerWeek: 60, errandsPeople: 2,
      trips: tripList.filter((t) => t.on),
      utilityId, useTOU: false, gasPrice: gasOutlook(catalog).mid, years: own.ownership_years_default,
      overrides: {}, retention5yOverride: null, homeCharging,
    };
    // Candidates: current EVs of the same kind that can do every drive;
    // compare against the one priced closest to the new gas vehicle.
    const tried = catalog.evs
      .filter((v) => evFitsKind(v, kind))
      .map((v) => {
        const price = v.msrp_usd + (v.destination_usd ?? 1500);
        const r = planHousehold({ ...base, candidate: { ref: `ev:${v.id}`, price, replaces: "a" } }, catalog);
        return { v, price, r };
      })
      .filter((x) => x.r.plan && x.r.plan.unassigned.length === 0);
    if (!tried.length) return { none: true as const, gas, tripList, homeCharging, gasRef };
    tried.sort((a, b) => Math.abs(a.price - gasPrice) - Math.abs(b.price - gasPrice));
    const best = tried[0];
    const { plan, gasAlt, range } = best.r;
    const saves = (evTotal: number | null, gasTotal: number | null) =>
      evTotal == null || gasTotal == null ? 0 : gasTotal - evTotal;
    const mid = saves(plan!.totalOverPeriod, gasAlt!.totalOverPeriod);
    const low = saves(range.low.plan, range.low.gasAlt);
    const high = saves(range.high.plan, range.high.gasAlt);
    const runSaves = gasAlt!.runningPerYear - plan!.runningPerYear;
    return { none: false as const, gas, ev: best.v, mid, low, high, runSaves, charging: plan!.charging, tripList, homeCharging, gasRef };
  }, [step, kind, commute, trips, parking, utilityId, catalog]);

  const handoff = useMemo(() => {
    if (!answer) return "/plan";
    const partial: Partial<PlanState> = {
      owned: [{ key: "a", ref: answer.gasRef, valueNow: catalog.own.default_owned_value_usd }],
      replaces: "a",
      drivers: [{ id: 1, commuteOneWayMi: commute ?? 0, daysPerWeek: commute ? 5 : 0 }],
      errandsMiPerWeek: 60, errandsPeople: 2,
      trips: answer.tripList,
      utilityId, gasRef: "auto", homeCharging: answer.homeCharging,
      ...(answer.none ? {} : { candRef: `ev:${answer.ev.id}` }),
    };
    return `/plan?from=quick&h=${encodeState(partial)}`;
  }, [answer, commute, utilityId, catalog]);

  const reset = () => { setParking(null); setKind(null); setCommute(null); setTrips(null); };
  const Choice = ({ label, onClick, hint }: { label: string; onClick: () => void; hint?: string }) => (
    <button type="button" onClick={onClick}
      className="w-full text-left rounded-xl border-2 border-slate-200 bg-white hover:border-brand px-4 py-3 min-h-12 transition">
      <span className="font-semibold text-ink">{label}</span>
      {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
    </button>
  );

  return (
    <section id="quick" aria-labelledby="quick-title" className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="quick-title" className="text-xl font-bold text-ink">Quick answer: would an EV cost you less?</h2>
        {step > 0 && <button type="button" onClick={reset} className="text-sm text-brand hover:underline shrink-0">Start over</button>}
      </div>
      {step < 4 && (
        <div className="mt-1 flex gap-1.5" aria-label={`Question ${step + 1} of 4`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand-bright" : "bg-slate-200"}`} />
          ))}
        </div>
      )}

      {step === 0 && (
        <div className="mt-4 space-y-2">
          <p className="font-medium text-ink">Where does your car sit overnight?</p>
          <p className="text-sm text-ink-muted">This matters most — charging at home costs about a quarter to a third of what public fast chargers charge.</p>
          <Choice label="In a garage or carport" onClick={() => setParking("garage")} />
          <Choice label="In my driveway or a spot at my house" onClick={() => setParking("driveway")} />
          <Choice label="On the street or in a shared lot" hint="Apartments, most rentals" onClick={() => setParking("street")} />
        </div>
      )}
      {step === 1 && (
        <div className="mt-4 space-y-2">
          <p className="font-medium text-ink">What do you drive most?</p>
          {KINDS.map((k) => <Choice key={k.v} label={k.label} onClick={() => setKind(k.v)} />)}
        </div>
      )}
      {step === 2 && (
        <div className="mt-4 space-y-2">
          <p className="font-medium text-ink">How far is your drive to work or school — one way?</p>
          {COMMUTES.map((c) => <Choice key={c.v} label={c.label} onClick={() => setCommute(c.v)} />)}
        </div>
      )}
      {step === 3 && (
        <div className="mt-4 space-y-2">
          <p className="font-medium text-ink">How often do you drive far from home?</p>
          <Choice label="Rarely" hint="A couple of long trips a year" onClick={() => setTrips("rare")} />
          <Choice label="Several road trips a year" hint="Family visits, a beach vacation" onClick={() => setTrips("several")} />
          <Choice label="I tow a trailer, camper, or boat" onClick={() => setTrips("tow")} />
        </div>
      )}

      {step === 4 && answer && answer.none && (
        <div className="mt-4 space-y-3">
          <p className="text-lg font-bold text-ink">No electric {KINDS.find((k) => k.v === kind)?.label.replace(/^An? /, "").toLowerCase()} we track handles all of that yet.</p>
          <p className="text-sm text-ink-muted">
            Many households keep a gas vehicle for the jobs an EV can&apos;t do and use an EV for everything else. The full plan
            can show whether adding one — instead of replacing — makes sense.
          </p>
          <Link href={handoff} className="inline-flex rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-3">See the full plan →</Link>
        </div>
      )}

      {step === 4 && answer && !answer.none && (() => {
        const { ev, gas, mid, low, high, runSaves } = answer;
        const wins = [low, mid, high].filter((x) => x >= 0).length;
        const headline =
          wins === 3 ? `A new ${ev.model} very likely costs you less than a new ${gas.model}.`
          : mid >= 0 ? `A new ${ev.model} likely costs you less than a new ${gas.model}.`
          : wins >= 1 ? `A new ${ev.model} and a new ${gas.model} come out about even.`
          : `A new ${gas.model} likely costs you less than a new ${ev.model}.`;
        return (
          <div className="mt-4 space-y-4">
            <p className="text-xl font-extrabold text-ink leading-snug">{headline}</p>
            <p className="text-ink-muted">
              Our best estimate over 5 years: the {ev.model} {mid >= 0 ? `saves about ${usd(mid)}` : `costs about ${usd(mid)} more`} —
              anywhere from {low >= 0 ? `saving ${usd(low)}` : `costing ${usd(low)} more`} to {high >= 0 ? `saving ${usd(high)}` : `costing ${usd(high)} more`},
              depending on what EVs are worth when you sell.
            </p>
            <SavingsRange low={Math.min(low, high)} mid={mid} high={Math.max(low, high)}
              ariaLabel={`Estimated 5-year difference: from ${usd(low)} to ${usd(high)}, most likely ${mid >= 0 ? "saving" : "costing"} ${usd(mid)}.`} />
            <ul className="text-sm text-ink space-y-1">
              <li><strong>Fuel and upkeep:</strong> about {usd(runSaves)} a year {runSaves >= 0 ? "less" : "more"} with the {ev.model}.</li>
              {answer.charging && <li><strong>Home charging:</strong> {answer.charging.reason}.</li>}
              <li className="text-ink-muted">Keeping the car you have is often cheapest of all — the full plan shows that too.</li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <Link href={handoff} className="inline-flex rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-3">
                See the full plan →
              </Link>
              <Link href={`/ev/${ev.id}`} className="inline-flex rounded-xl border border-slate-300 bg-white hover:border-brand text-ink font-semibold px-5 py-3">
                About the {ev.model}
              </Link>
            </div>
            <p className="text-xs text-ink-soft flex flex-wrap items-center gap-1">
              <label className="inline-flex items-center gap-1">
                <span>Utility:</span>
                <select value={utilityId} onChange={(e) => setUtilityId(e.target.value)} className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs">
                  {catalog.utilities.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
              <span>· gas ${gasOutlook(catalog).mid.toFixed(2)} forecast · sticker prices · 5 years · compared with the EV priced closest to a new {gas.model}.</span>
            </p>
          </div>
        );
      })()}
    </section>
  );
}
