import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CopyLinkButton, PrintButton } from "@/components/PrintButton";
import { annualIceMaintenance, calculate, fmtNum, fmtUSD, fmtUSDsigned } from "@/lib/calc";
import { getFederalData, getIceVehicles, getUtilities, getVehicles } from "@/lib/data";
import type { Vehicle, VehicleResult } from "@/lib/types";

export const metadata: Metadata = {
  title: "Your WV EV analysis — GoEV WV",
  description: "Printable summary of your EV comparison for West Virginia.",
  robots: { index: false, follow: false },
};

// Next.js 14 App Router: searchParams is a plain record
type SearchParams = Record<string, string | string[] | undefined>;

function str(p: SearchParams, k: string, fallback: string): string {
  const v = p[k];
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}
function num(p: SearchParams, k: string, fallback: number): number {
  const raw = str(p, k, "");
  const n = Number(raw);
  return Number.isFinite(n) && raw !== "" ? n : fallback;
}
function bool(p: SearchParams, k: string, fallback: boolean): boolean {
  const raw = str(p, k, "");
  if (raw === "") return fallback;
  return raw === "1" || raw === "true";
}

export default function ReportPage({ searchParams }: { searchParams: SearchParams }) {
  const p = searchParams;

  const vehicles = getVehicles();
  const iceVehicles = getIceVehicles();
  const utilities = getUtilities();
  const federal = getFederalData();

  const daily = num(p, "mi", 30);
  const days = num(p, "d", 5);
  const utilityId = str(p, "u", "aep");
  const useTOU = bool(p, "tou", false);
  const winter = bool(p, "w", true);
  const mpg = num(p, "mpg", 25);
  const gasPrice = num(p, "gas", 3.15);
  const longTrips = num(p, "lt", 4);
  const longTripMi = num(p, "ltm", 200);
  const vidsRaw = str(p, "v", "");
  const selectedIds = vidsRaw.split(",").filter(Boolean).slice(0, 3);
  const iceVehicleId = str(p, "iv", "");

  const utility = utilities.find((u) => u.id === utilityId) ?? utilities[0];
  const selectedVehicles = vehicles.filter((v) => selectedIds.includes(v.id));
  const iceVehicle = iceVehicles.find((v) => v.id === iceVehicleId) ?? null;

  // Nothing to report on
  if (selectedVehicles.length === 0) {
    return (
      <main className="mx-auto max-w-content px-4 sm:px-6 py-12">
        <h1 className="text-2xl font-bold text-ink mb-3">No vehicles selected</h1>
        <p className="text-ink-muted mb-6">
          This report page needs a set of vehicles to compare. Head back to the calculator, pick 1–3 EVs, then
          print from there.
        </p>
        <Link href="/" className="text-brand font-medium hover:underline">← Back to the calculator</Link>
      </main>
    );
  }

  const out = calculate(
    {
      daily_round_trip_mi: daily,
      days_per_week: days,
      utility_id: utility.id,
      use_tou: useTOU,
      current: {
        mpg,
        gas_price_per_gal: gasPrice,
        ice_vehicle: iceVehicle ?? undefined,
      },
      apply_winter_derate: winter,
      vehicle_ids: selectedIds,
      long_trips_per_year: longTrips,
      long_trip_one_way_mi: longTripMi,
    },
    { vehicles: selectedVehicles, utility, fed: federal },
  );

  const iceMaint = iceVehicle ? annualIceMaintenance(iceVehicle, out.annual_miles) : null;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-8 print:py-4 print:max-w-full">
      {/* Actions — hidden when printing */}
      <div className="no-print flex items-center justify-between gap-3 flex-wrap mb-8">
        <Link href={`/?${editInputsQuery(p)}`} className="text-sm text-ink-soft hover:text-ink">
          ← Edit inputs
        </Link>
        <div className="flex gap-2">
          <CopyLinkButton />
          <PrintButton />
        </div>
      </div>

      {/* Header */}
      <header className="mb-8 print:mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Logo className="text-xl mb-2" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-ink leading-tight">
              Your WV EV analysis
            </h1>
          </div>
          <div className="text-right text-xs text-ink-soft">
            <div>Generated {dateStr}</div>
            <div>goevwv.com</div>
          </div>
        </div>
      </header>

      {/* Inputs summary */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-2">Your inputs</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
          <InputRow label="Daily round-trip" value={`${fmtNum(daily)} mi`} />
          <InputRow label="Days per week" value={`${days}`} />
          <InputRow label="Annual miles" value={fmtNum(out.annual_miles)} />
          <InputRow label="Utility" value={utility.name} />
          <InputRow
            label="Electric rate"
            value={`${fmtNum(out.rate_per_kwh * 100, 1)}¢/kWh (${out.rate_mode === "tou" ? "TOU off-peak" : "flat"})`}
          />
          <InputRow label="Winter derate" value={winter ? "On (+12% kWh)" : "Off"} />
          <InputRow
            label="Current vehicle"
            value={iceVehicle ? `${iceVehicle.year} ${iceVehicle.make} ${iceVehicle.model}` : `${mpg} mpg`}
          />
          <InputRow label="Gas price" value={`$${gasPrice.toFixed(2)}/gal`} />
          <InputRow label="Long road trips/yr" value={`${longTrips}`} />
          <InputRow label="Long-trip one-way" value={`${longTripMi} mi`} />
        </dl>
      </section>

      {/* Current vehicle baseline */}
      <section className="mb-8 rounded-xl ring-1 ring-slate-300 p-4 print:ring-slate-400">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-1">
          Current vehicle baseline
        </div>
        <div className="text-2xl font-bold text-ink tabular-nums">
          {fmtUSD(out.current_annual_total_usd || out.current_annual_gas_cost)}
          <span className="text-sm font-normal text-ink-soft"> /year total</span>
        </div>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-ink-muted">
          <div>{fmtUSD(out.current_annual_gas_cost)} gas</div>
          {iceMaint && <div>{fmtUSD(iceMaint.oil_usd)} oil</div>}
          {iceMaint && <div>{fmtUSD(iceMaint.tires_usd + iceMaint.brakes_usd + iceMaint.misc_usd)} tires/brakes/misc</div>}
          {out.current_annual_insurance_usd > 0 && <div>{fmtUSD(out.current_annual_insurance_usd)} insurance</div>}
          <div>{fmtNum(out.current_annual_co2_kg / 1000, 2)} t CO₂/yr</div>
          <div>{fmtNum(out.current_annual_fueling_min / 60, 1)} hrs/yr at the pump</div>
        </div>
      </section>

      {/* Per-EV cards */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-3">
          {out.results.length === 1 ? "EV comparison" : `${out.results.length}-way EV comparison`}
        </h2>
        <div className="grid gap-4 print:gap-3 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
          {out.results.map((r) => (
            <ReportCard key={r.vehicle.id} r={r} hasIce={!!iceMaint} />
          ))}
        </div>
      </section>

      {/* Assumptions (condensed) */}
      <section className="mb-8 text-xs text-ink-muted">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-2">Assumptions</h2>
        <ul className="list-disc list-inside space-y-1 leading-relaxed">
          <li>
            Utility rate: {utility.name} —{" "}
            {out.rate_mode === "tou"
              ? `TOU off-peak at ${fmtNum(out.rate_per_kwh * 100, 1)}¢/kWh (100% off-peak charging assumed)`
              : `flat ${fmtNum(out.rate_per_kwh * 100, 1)}¢/kWh`}
            .
          </li>
          <li>
            Winter derate: {winter ? "ON (+12% annual kWh, reflects 4 cold months of ~28% range loss)" : "OFF"}.
          </li>
          <li>
            WV state EV fee: $250/yr BEV, $100/yr PHEV — included in annual total.
          </li>
          <li>
            Federal IRA EV tax credit repealed in 2025 — not included.
          </li>
          <li>
            PHEVs modeled at 65% electric / 35% gas miles (INL/Argonne fleet data).
          </li>
          <li>
            WV grid CO₂ factor: 0.67 kg/kWh (EIA state profile). WV is part of PJM, so as the grid adds
            renewables, EV emissions fall automatically — a gas car&rsquo;s emissions never change.
          </li>
          <li>
            Resale: EVs typically depreciate 50–65% over 5 years nationally. WV has ~1,900 registered EVs —
            a thin local resale market may mean steeper depreciation.
          </li>
          <li>
            Estimates, not professional financial advice. Rate and rebate data reviewed quarterly.
          </li>
        </ul>
      </section>

      {/* Footer */}
      <footer className="mt-10 pt-4 border-t border-slate-200 text-xs text-ink-soft">
        <p>
          Generated at <strong className="text-ink">goevwv.com</strong> — a WV-specific EV advisor. This
          report reflects the inputs you provided. Rerun anytime with different vehicles, commute, or
          utility.
        </p>
        <p className="mt-2 no-print">
          <Link href="/about" className="text-brand hover:underline">
            Why I built this →
          </Link>
        </p>
      </footer>
    </main>
  );
}

function editInputsQuery(p: SearchParams): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === "string") out.set(k, v);
    else if (Array.isArray(v) && v[0] !== undefined) out.set(k, v[0]);
  }
  return out.toString();
}

function InputRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="text-ink font-medium">{value}</dd>
    </div>
  );
}

function ReportCard({ r, hasIce }: { r: VehicleResult; hasIce: boolean }) {
  const savings = r.annual_savings_vs_current_usd;
  const positive = savings >= 0;
  return (
    <article className="rounded-xl ring-1 ring-slate-300 print:ring-slate-400 p-4 flex flex-col gap-3 break-inside-avoid">
      <header>
        <div className="text-xs uppercase tracking-wider text-ink-soft font-semibold">
          {r.vehicle.year} {r.vehicle.make}
        </div>
        <div className="font-bold text-ink text-base leading-tight">{r.vehicle.model}</div>
        <div className="text-xs text-ink-soft">{r.vehicle.trim} · {powertrainLabel(r.vehicle.powertrain)}</div>
      </header>

      <div className={["rounded-lg p-2.5 text-sm", positive ? "bg-brand-bg text-brand-dark" : "bg-amber-50 text-amber-900"].join(" ")}>
        <div className="text-[10px] uppercase tracking-wide opacity-70">
          {positive ? "Annual savings" : "Annual extra cost"} vs your current {hasIce ? "vehicle" : "gas bill"}
        </div>
        <div className="text-lg font-bold tabular-nums">
          {fmtUSD(Math.abs(savings))}
          <span className="text-[10px] font-normal opacity-70"> /yr</span>
        </div>
        <div className="text-[10px] opacity-75">
          {fmtUSD(Math.abs(r.five_year_savings_vs_current_usd))} {positive ? "saved" : "more"} over 5 yr
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
        <Row label="Annual energy" value={fmtUSD(r.annual_energy_cost_usd)} />
        {r.annual_state_fee_usd > 0 && <Row label="WV fee" value={fmtUSD(r.annual_state_fee_usd)} />}
        {hasIce && r.annual_maintenance_usd > 0 && (
          <Row label="Maintenance" value={fmtUSD(r.annual_maintenance_usd)} />
        )}
        {hasIce && r.annual_insurance_usd > 0 && (
          <Row label="Insurance" value={fmtUSD(r.annual_insurance_usd)} />
        )}
        <Row label="Total/yr" value={fmtUSD(r.annual_total_usd)} strong />
        <Row label="CO₂ avoided" value={`${fmtNum(r.co2_saved_vs_current_kg_per_year / 1000, 2)} t/yr`} />
        <Row label="MSRP" value={fmtUSD(r.vehicle.msrp_usd)} />
        {r.vehicle.assembly_location && (
          <Row label="Assembly" value={r.vehicle.assembly_location} />
        )}
        {r.vehicle.us_canadian_parts_pct !== undefined && (
          <Row
            label="US/CA parts"
            value={r.vehicle.us_canadian_parts_pct === null ? "N/A (exempt)" : `${r.vehicle.us_canadian_parts_pct}%`}
          />
        )}
      </dl>

      {r.warnings.length > 0 && (
        <ul className="text-[11px] text-amber-800 bg-amber-50 rounded p-2 space-y-0.5 list-disc list-inside">
          {r.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
    </article>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <>
      <dt className="text-ink-soft">{label}</dt>
      <dd className={["text-right tabular-nums", strong ? "font-semibold text-ink" : ""].join(" ")}>
        {value}
      </dd>
    </>
  );
}

function powertrainLabel(p: Vehicle["powertrain"]): string {
  switch (p) {
    case "bev": return "Electric";
    case "phev": return "Plug-in hybrid";
    case "hybrid": return "Hybrid";
    default: return p;
  }
}
