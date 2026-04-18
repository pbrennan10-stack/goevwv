"use client";

import { useState } from "react";

export type FitCheckResult = {
  charging: "yes" | "no" | "unsure";
  miles: "under40" | "40-80" | "over80";
  trips: "rarely" | "monthly" | "weekly";
  verdict: "fit" | "likely" | "maybe" | "notyet";
  hasHomeCharging: boolean;
};

type ChargingAnswer = "yes" | "no" | "unsure";
type MilesAnswer = "under40" | "40-80" | "over80";
type TripsAnswer = "rarely" | "monthly" | "weekly";
type Verdict = "fit" | "likely" | "maybe" | "notyet";

function computeVerdict(charging: ChargingAnswer, miles: MilesAnswer, trips: TripsAnswer): Verdict {
  if (charging === "yes") {
    if (miles !== "over80") return "fit";
    if (trips === "weekly") return "maybe";
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
        Home charging covers your daily driving. For high-mileage days, BEVs may occasionally need
        a public top-up. WV winters cut range ~28% on the coldest days — check each
        vehicle&rsquo;s winter range in the calculator. PHEVs handle longer days more flexibly.
      </p>
    );
  }
  if (verdict === "maybe" && charging === "yes") {
    return (
      <p className="text-sm text-ink-muted">
        You drive a lot and take frequent long trips. A PHEV may suit you better than a BEV: it
        runs on electric for daily commutes and switches to gas for highway runs, avoiding range
        anxiety. A BEV would need careful planning given WV&rsquo;s DCFC gaps on I-77 south and
        rural I-79.
      </p>
    );
  }
  if (verdict === "maybe") {
    return (
      <p className="text-sm text-ink-muted">
        Short daily drive and rare long trips — this could work if you&rsquo;re in or near
        Morgantown, Charleston, Huntington, Parkersburg, Wheeling, or Martinsburg, which have
        workable public charging. Rural WV without home charging is genuinely difficult. Even a
        standard 120V outdoor outlet adds 3–5 miles of range per hour overnight and changes the
        math significantly.
      </p>
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
      <p>
        If you&rsquo;re close to installing a home outlet, that changes the picture: a Level 2
        charger ($800–$3,200 installed) adds 20–30 miles of range per hour. AEP customers can get
        $500 back toward installation.
      </p>
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
            3. How often do you take long drives — 150+ miles one way? (WV to Pittsburgh, DC,
            Charlotte, etc.)
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {(
              [
                ["rarely", "Rarely — a few times a year"],
                ["monthly", "Monthly-ish"],
                ["weekly", "Weekly or more"],
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
