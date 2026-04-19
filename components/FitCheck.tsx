"use client";

import { useState } from "react";

export type FitCheckResult = {
  charging: "yes" | "no" | "unsure";
  miles: "under40" | "40-80" | "over80";
  trips: "rarely" | "routine" | "varied";
  verdict: "fit" | "likely" | "maybe" | "notyet";
  hasHomeCharging: boolean;
};

type ChargingAnswer = "yes" | "no" | "unsure";
type MilesAnswer = "under40" | "40-80" | "over80";
type TripsAnswer = "rarely" | "routine" | "varied";
type Verdict = "fit" | "likely" | "maybe" | "notyet";

function computeVerdict(charging: ChargingAnswer, miles: MilesAnswer, trips: TripsAnswer): Verdict {
  if (charging === "yes") {
    if (miles !== "over80") return "fit";
    // Same-place repeat trips become routine once scoped; varied destinations
    // keep adding planning overhead each time.
    if (trips === "varied") return "maybe";
    return "likely";
  }
  // no or unsure — treat both conservatively
  if (miles === "under40" && trips === "rarely") return "maybe";
  return "notyet";
}

const VERDICT_UI: Record<Verdict, { icon: string; heading: string; color: string }> = {
  fit: {
    icon: "✅",
    heading: "Likely a great fit",
    color: "bg-green-50 ring-1 ring-green-200",
  },
  likely: {
    icon: "✅",
    heading: "Good fit — check winter range",
    color: "bg-green-50 ring-1 ring-green-200",
  },
  maybe: {
    icon: "⚠️",
    heading: "Could work — some important caveats",
    color: "bg-amber-50 ring-1 ring-amber-200",
  },
  notyet: {
    icon: "❌",
    heading: "Not yet — WV charging too thin without home access",
    color: "bg-red-50 ring-1 ring-red-200",
  },
};

function VerdictDetail({
  verdict,
  charging,
}: {
  verdict: Verdict;
  charging: ChargingAnswer;
}) {
  if (verdict === "fit") {
    return (
      <p className="text-sm text-ink-muted">
        You have what matters most: a place to charge at home and a manageable daily drive. Most WV
        home-chargers spend less than 5 minutes a week on charging — plug in when you park, full
        battery every morning. Use the calculator below to see exact savings for your commute and
        utility.
      </p>
    );
  }
  if (verdict === "likely") {
    return (
      <p className="text-sm text-ink-muted">
        Home charging handles your daily driving. Long trips to the same handful of places — a
        cabin, family visits, a regular work destination — become routine once you scope out the
        charging stops the first time (5 minutes on PlugShare — a free app that maps every public charger — or your car&rsquo;s built-in navigation before
        you leave). WV winters cut range ~28% on the coldest days, so check each vehicle&rsquo;s
        winter range in the calculator. A PHEV works well here too if you&rsquo;d rather skip
        long-trip planning entirely.
      </p>
    );
  }
  if (verdict === "maybe" && charging === "yes") {
    return (
      <p className="text-sm text-ink-muted">
        You drive a lot and your long trips go to <em>varied</em> destinations — each new route
        means reviewing charger locations ahead of time. A PHEV likely fits better: it runs on
        electric daily and switches to gas for unfamiliar highway runs, so you don&rsquo;t think
        about charging mid-trip. A BEV still works, but expect to spend ~5 minutes on PlugShare (the free EV-charger app)
        or your in-car route planner before each first visit to a new place. Trips you repeat
        settle into routine after the first run — the friction is mostly first-time routes.
      </p>
    );
  }
  if (verdict === "maybe") {
    return (
      <div className="text-sm text-ink-muted space-y-2">
        <p>
          Short daily drive and rare long trips — this could work if you&rsquo;re in or near
          Morgantown, Charleston, Huntington, Parkersburg, Wheeling, or Martinsburg, which have
          workable public charging. Rural WV without home charging is genuinely difficult.
        </p>
        <p>
          <strong>Check what outlets you already have before ruling it out.</strong> If you have
          a 240V outlet at home (dryer, welder, RV hookup, garage 50-amp), a portable Level 2
          charger is $200–$500 and works the day it arrives — no electrician needed. That adds
          ~20 miles of range per hour and changes the picture significantly. Even a standard
          120V outlet adds 3–5 mi/hr overnight and is enough for a short daily drive.
        </p>
      </div>
    );
  }
  // notyet
  return (
    <div className="text-sm text-ink-muted space-y-2">
      <p>
        WV has about 55 DC fast chargers statewide — most clustered along I-64, I-79, and in
        Morgantown, Charleston, Huntington, Parkersburg, and Wheeling. Without home charging,
        you&rsquo;d rely on public chargers that are 30–60 miles apart in rural areas.
      </p>
      <p>
        The federal NEVI program allocated $45.7M to WV for 15 new charging stations — but as of
        April 2026, no RFP has been issued.{" "}
        <strong>Earliest new stations: 2027 at best.</strong> This may change — check back as
        infrastructure improves.
      </p>
      <div className="space-y-1">
        <p className="font-medium text-ink">Three home-charging tiers, cheapest first:</p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li>
            <strong>Already have a 240V outlet?</strong> (dryer, welder, RV hookup, or a
            50-amp circuit in the garage) — a <strong>portable Level 2 charger is
            $200–$500</strong> and works the day it arrives. No electrician. Adds ~20 mi of
            range per hour. This is the option most people overlook.
          </li>
          <li>
            <strong>Wall-mounted Level 2 install:</strong> $800–$3,200 for hardware plus a
            licensed electrician. <strong>AEP customers can get $500 back.</strong> Fastest
            (up to 48 amps) and cleanest install.
          </li>
          <li>
            <strong>Standard 120V outlet:</strong> slow — 3–5 mi/hr overnight — but works
            for short commutes.
          </li>
        </ul>
      </div>
    </div>
  );
}

export function FitCheck() {
  const [step, setStep] = useState(0);
  const [charging, setCharging] = useState<ChargingAnswer | null>(null);
  const [miles, setMiles] = useState<MilesAnswer | null>(null);
  const [trips, setTrips] = useState<TripsAnswer | null>(null);

  const verdict = charging && miles && trips ? computeVerdict(charging, miles, trips) : null;
  const ui = verdict ? VERDICT_UI[verdict] : null;

  function reset() {
    setStep(0);
    setCharging(null);
    setMiles(null);
    setTrips(null);
  }

  return (
    <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 sm:p-7 mb-8">
      <h2 className="text-lg font-semibold text-ink mb-1">Does an EV fit your life?</h2>
      <p className="text-sm text-ink-soft mb-5">3 questions. Honest, WV-specific answer.</p>

      {step === 0 && (
        <div>
          <p className="text-sm font-medium text-ink mb-3">
            1. Do you have a place to plug in at home — a garage, carport, or driveway outlet?
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {(
              [
                ["yes", "Yes — garage, carport, or driveway"],
                ["no", "No — I rent or have no outdoor outlet"],
                ["unsure", "Not sure yet"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setCharging(val);
                  setStep(1);
                }}
                className="flex-1 rounded-xl border border-slate-200 bg-white hover:border-brand hover:bg-brand-bg px-4 py-3 text-sm text-ink text-left transition"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <p className="text-xs text-ink-soft mb-3">Question 1 of 3 answered</p>
          <p className="text-sm font-medium text-ink mb-3">
            2. What&rsquo;s your typical daily round-trip? (home to wherever you go most days, and
            back)
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {(
              [
                ["under40", "Under 40 miles"],
                ["40-80", "40–80 miles"],
                ["over80", "Over 80 miles"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setMiles(val);
                  setStep(2);
                }}
                className="flex-1 rounded-xl border border-slate-200 bg-white hover:border-brand hover:bg-brand-bg px-4 py-3 text-sm text-ink text-left transition"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="text-xs text-ink-soft mb-3">Questions 1–2 of 3 answered</p>
          <p className="text-sm font-medium text-ink mb-3">
            3. When you take long drives (150+ mi one-way — WV → Pittsburgh, DC, Charlotte,
            Columbus), what&rsquo;s the pattern?
          </p>
          <p className="text-xs text-ink-soft mb-3">
            Repeat trips to the same place become routine after you scope the route once. Varied
            destinations mean planning fresh each time.
          </p>
          <div className="flex flex-col gap-2">
            {(
              [
                ["rarely", "Rarely — a few times a year"],
                ["routine", "Regularly, but mostly the same destinations (you know the route)"],
                ["varied", "Regularly, different destinations each time"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => {
                  setTrips(val);
                  setStep(3);
                }}
                className="flex-1 rounded-xl border border-slate-200 bg-white hover:border-brand hover:bg-brand-bg px-4 py-3 text-sm text-ink text-left transition"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && verdict && ui && charging && miles && trips && (
        <div className={`rounded-xl p-4 ${ui.color}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl" aria-hidden="true">
              {ui.icon}
            </span>
            <span className="font-semibold text-ink text-base">{ui.heading}</span>
          </div>
          <div className="mb-4">
            <VerdictDetail verdict={verdict} charging={charging} />
          </div>
          <div className="text-xs text-ink-soft border-t border-slate-200 pt-3 mt-2">
            <span className="font-medium">Your answers:</span> Home charging:{" "}
            <strong>{charging}</strong> · Daily miles: <strong>{miles}</strong> · Long trips:{" "}
            <strong>{trips}</strong>
            <button
              type="button"
              onClick={reset}
              className="ml-3 underline hover:text-ink transition"
            >
              Start over
            </button>
          </div>
          <p className="mt-3 text-xs text-ink-soft">
            This is a quick filter, not the full picture. Use the calculator below for exact numbers
            on your commute, utility, and the vehicles you&rsquo;re considering.
          </p>
        </div>
      )}
    </section>
  );
}
