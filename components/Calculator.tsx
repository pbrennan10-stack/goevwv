"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculate,
  fmtNum,
  fmtUSD,
  fmtUSDsigned,
  type CalcReturn,
} from "@/lib/calc";
import type {
  CalcInput,
  FederalData,
  Utility,
  Vehicle,
  VehicleResult,
} from "@/lib/types";

interface Props {
  vehicles: Vehicle[];
  utilities: Utility[];
  federal: FederalData;
}

const DEFAULT_INPUT: Omit<CalcInput, "vehicle_ids"> = {
  daily_round_trip_mi: 30,
  days_per_week: 5,
  utility_id: "aep",
  use_tou: false,
  current: {
    mpg: 25,
    gas_price_per_gal: 3.15,
  },
  apply_winter_derate: true,
};

export function Calculator({ vehicles, utilities, federal }: Props) {
  const [daily, setDaily] = useState(DEFAULT_INPUT.daily_round_trip_mi);
  const [days, setDays] = useState(DEFAULT_INPUT.days_per_week);
  const [utilityId, setUtilityId] = useState(DEFAULT_INPUT.utility_id);
  const [useTOU, setUseTOU] = useState(DEFAULT_INPUT.use_tou);
  const [winter, setWinter] = useState(DEFAULT_INPUT.apply_winter_derate);
  const [mpg, setMpg] = useState(DEFAULT_INPUT.current.mpg);
  const [gasPrice, setGasPrice] = useState(
    DEFAULT_INPUT.current.gas_price_per_gal,
  );

  // Hydrate from URL on first load so shareable URLs work.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const num = (k: string, fallback: number) => {
      const v = p.get(k);
      const n = v == null ? NaN : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const str = (k: string, fallback: string) => p.get(k) ?? fallback;
    const bool = (k: string, fallback: boolean) => {
      const v = p.get(k);
      if (v == null) return fallback;
      return v === "1" || v === "true";
    };
    setDaily(num("mi", DEFAULT_INPUT.daily_round_trip_mi));
    setDays(num("d", DEFAULT_INPUT.days_per_week));
    setUtilityId(str("u", DEFAULT_INPUT.utility_id));
    setUseTOU(bool("tou", DEFAULT_INPUT.use_tou));
    setWinter(bool("w", DEFAULT_INPUT.apply_winter_derate));
    setMpg(num("mpg", DEFAULT_INPUT.current.mpg));
    setGasPrice(num("gas", DEFAULT_INPUT.current.gas_price_per_gal));
    const vids = p.get("v");
    if (vids) {
      const ids = vids.split(",").filter(Boolean).slice(0, 3);
      setSelectedIds(ids);
    }
  }, []);

  // Default selected vehicles (picked to be interesting for WV).
  const [selectedIds, setSelectedIds] = useState<string[]>([
    "chevy-equinox-ev-2025",
    "toyota-rav4-prime-2025",
    "ford-f150-lightning-2025",
  ]);

  const utility = useMemo(
    () => utilities.find((u) => u.id === utilityId) ?? utilities[0],
    [utilities, utilityId],
  );

  const selectedVehicles = useMemo(
    () => vehicles.filter((v) => selectedIds.includes(v.id)),
    [vehicles, selectedIds],
  );

  const out: CalcReturn | null = useMemo(() => {
    if (selectedVehicles.length === 0) return null;
    return calculate(
      {
        daily_round_trip_mi: daily,
        days_per_week: days,
        utility_id: utilityId,
        use_tou: useTOU,
        current: { mpg, gas_price_per_gal: gasPrice },
        apply_winter_derate: winter,
        vehicle_ids: selectedIds,
      },
      { vehicles: selectedVehicles, utility, fed: federal },
    );
  }, [daily, days, utilityId, useTOU, winter, mpg, gasPrice, selectedVehicles, utility, federal, selectedIds]);

  // Sync state to URL so results are shareable.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams();
    p.set("mi", String(daily));
    p.set("d", String(days));
    p.set("u", utilityId);
    if (useTOU) p.set("tou", "1");
    if (!winter) p.set("w", "0");
    p.set("mpg", String(mpg));
    p.set("gas", String(gasPrice));
    p.set("v", selectedIds.join(","));
    const newUrl = `${window.location.pathname}?${p.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, [daily, days, utilityId, useTOU, winter, mpg, gasPrice, selectedIds]);

  const toggleVehicle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev; // cap at 3
      return [...prev, id];
    });
  }, []);

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 sm:p-7">
        <h2 className="text-lg font-semibold text-ink mb-5">
          Tell us about your driving and utility
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <NumField
            label="Daily round-trip miles"
            value={daily}
            onChange={setDaily}
            min={1}
            max={500}
            step={1}
            hint="Home to work and back, typical weekday."
          />
          <NumField
            label="Days per week you drive it"
            value={days}
            onChange={setDays}
            min={1}
            max={7}
            step={1}
            hint={`= ${fmtNum(daily * days * 52)} miles/year`}
          />

          <SelectField
            label="Your electric utility"
            value={utilityId}
            onChange={setUtilityId}
            options={utilities.map((u) => ({ value: u.id, label: u.name }))}
          />

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={useTOU}
                onChange={(e) => setUseTOU(e.target.checked)}
                disabled={!utility.residential.tou_available}
                className="h-4 w-4 rounded accent-brand disabled:opacity-50"
              />
              <span>
                Use time-of-use (off-peak) EV rate
                {!utility.residential.tou_available && (
                  <span className="text-ink-soft"> — not offered by {utility.name}</span>
                )}
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={winter}
                onChange={(e) => setWinter(e.target.checked)}
                className="h-4 w-4 rounded accent-brand"
              />
              <span>Apply WV winter range/efficiency derate (~12%/yr)</span>
            </label>
          </div>

          <NumField
            label="Your current car's MPG"
            value={mpg}
            onChange={setMpg}
            min={5}
            max={100}
            step={1}
            hint="EPA combined, or your real-world observed mileage."
          />
          <NumField
            label="Gas price ($/gal)"
            value={gasPrice}
            onChange={setGasPrice}
            min={1}
            max={10}
            step={0.05}
            decimals={2}
            hint="WV average ~$3.15 (AAA)."
          />
        </div>
      </section>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 sm:p-7">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-ink">
            Pick vehicles to compare
          </h2>
          <span className="text-sm text-ink-soft">
            {selectedIds.length}/3 selected
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => {
            const on = selectedIds.includes(v.id);
            const full = selectedIds.length >= 3 && !on;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => toggleVehicle(v.id)}
                disabled={full}
                className={[
                  "text-left rounded-xl border p-3 transition",
                  on
                    ? "border-brand bg-brand-bg"
                    : "border-slate-200 bg-white hover:border-slate-300",
                  full ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-1 h-4 w-4 rounded border border-slate-300 flex items-center justify-center">
                    {on && (
                      <div className="h-2.5 w-2.5 rounded-sm bg-brand" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-ink text-sm truncate">
                      {v.year} {v.make} {v.model}
                    </div>
                    <div className="text-xs text-ink-soft truncate">
                      {v.trim} · {powertrainLabel(v.powertrain)} ·{" "}
                      {fmtUSD(v.msrp_usd)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {out && <Results out={out} utility={utility} />}

      <Assumptions
        utility={utility}
        winter={winter}
        useTOU={useTOU}
        fed={federal}
      />
    </div>
  );
}

function Results({
  out,
  utility,
}: {
  out: CalcReturn;
  utility: Utility;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-ink">Results</h2>
        <div className="text-sm text-ink-soft">
          At {fmtNum(out.annual_miles)} mi/yr · rate{" "}
          <strong>{fmtNum(out.rate_per_kwh * 100, 1)}¢/kWh</strong>{" "}
          ({out.rate_mode === "tou" ? "blended TOU" : "flat"}) via{" "}
          <strong>{utility.name}</strong>
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5">
        <div className="text-sm text-ink-muted mb-1">Your current vehicle</div>
        <div className="flex justify-between items-baseline flex-wrap gap-2">
          <div className="text-2xl font-semibold text-ink">
            {fmtUSD(out.current_annual_gas_cost)}
            <span className="text-sm font-normal text-ink-soft"> /year in gas</span>
          </div>
          <div className="text-sm text-ink-soft">
            {fmtNum(out.current_annual_co2_kg / 1000, 2)} tons CO₂/yr
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {out.results.map((r) => (
          <ResultCard key={r.vehicle.id} r={r} />
        ))}
      </div>
    </section>
  );
}

function ResultCard({ r }: { r: VehicleResult }) {
  const savings = r.annual_savings_vs_current_usd;
  const positive = savings >= 0;
  return (
    <article className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 flex flex-col gap-3">
      <header>
        <div className="text-xs uppercase tracking-wider text-ink-soft font-semibold">
          {r.vehicle.year} {r.vehicle.make}
        </div>
        <div className="font-semibold text-ink text-lg leading-tight">
          {r.vehicle.model}
        </div>
        <div className="text-sm text-ink-soft">
          {r.vehicle.trim} · {powertrainLabel(r.vehicle.powertrain)}
        </div>
      </header>

      <div
        className={[
          "rounded-lg p-3 font-mono text-sm",
          positive ? "bg-brand-bg text-brand-dark" : "bg-amber-50 text-amber-900",
        ].join(" ")}
      >
        <div className="text-xs uppercase tracking-wide opacity-70 mb-0.5">
          vs your current car
        </div>
        <div className="text-xl font-bold tabular-nums">
          {fmtUSDsigned(savings)}
          <span className="text-xs font-normal opacity-70"> /year</span>
        </div>
        <div className="text-xs opacity-75">
          {fmtUSDsigned(r.five_year_savings_vs_current_usd)} over 5 yr
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <Row label="Annual energy" value={fmtUSD(r.annual_energy_cost_usd)} />
        {r.annual_state_fee_usd > 0 && (
          <Row
            label="WV annual fee"
            value={fmtUSD(r.annual_state_fee_usd)}
            muted
          />
        )}
        <Row
          label="Total /yr to own"
          value={fmtUSD(r.annual_total_usd)}
          strong
        />
        <Row
          label="CO₂ avoided /yr"
          value={`${fmtNum(r.co2_saved_vs_current_kg_per_year / 1000, 2)} t`}
        />
        <Row
          label="MSRP"
          value={fmtUSD(r.vehicle.msrp_usd)}
          muted={r.federal_credit_usd > 0}
        />
        {r.federal_credit_usd > 0 && (
          <>
            <Row
              label="Fed IRA credit"
              value={`-${fmtUSD(r.federal_credit_usd)}`}
              className="text-brand-dark"
            />
            <Row
              label="Effective price"
              value={fmtUSD(r.effective_msrp_usd)}
              strong
            />
          </>
        )}
      </dl>

      {r.warnings.length > 0 && (
        <ul className="text-xs text-amber-800 bg-amber-50 rounded-md p-2 space-y-1 list-disc list-inside">
          {r.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
  className = "",
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <>
      <dt
        className={[
          "text-ink-soft",
          muted ? "opacity-70" : "",
          className,
        ].join(" ")}
      >
        {label}
      </dt>
      <dd
        className={[
          "text-right tabular-nums",
          strong ? "font-semibold text-ink" : "",
          muted ? "opacity-70" : "",
          className,
        ].join(" ")}
      >
        {value}
      </dd>
    </>
  );
}

function Assumptions({
  utility,
  winter,
  useTOU,
  fed,
}: {
  utility: Utility;
  winter: boolean;
  useTOU: boolean;
  fed: FederalData;
}) {
  return (
    <section className="rounded-2xl bg-surface-sunken ring-1 ring-slate-200 p-5 text-sm text-ink-muted">
      <details>
        <summary className="cursor-pointer font-medium text-ink">
          Assumptions behind these numbers
        </summary>
        <ul className="mt-3 space-y-2 list-disc list-inside">
          <li>
            Utility rate:{" "}
            <strong>
              {utility.name} — {useTOU && utility.residential.tou_available
                ? `TOU blended (${fmtNum(
                    (utility.residential.tou_schedule?.off_peak_rate_per_kwh ?? 0) * 100,
                    1,
                  )}¢ off-peak, ${fmtNum(
                    (utility.residential.tou_schedule?.on_peak_rate_per_kwh ?? 0) * 100,
                    1,
                  )}¢ on-peak, 75% off-peak share)`
                : `flat ${fmtNum(utility.residential.flat_rate_per_kwh * 100, 1)}¢/kWh`}
            </strong>
          </li>
          <li>
            Winter derate: <strong>{winter ? "on" : "off"}</strong>. When on we
            add ~12% to annual kWh to reflect 4 cold-weather months with ~28%
            range loss from heaters and battery chemistry.
          </li>
          <li>
            WV EV road fee:{" "}
            <strong>${fed.wv_state_fees.bev_annual_fee.amount_usd}/year BEV, ${fed.wv_state_fees.phev_annual_fee.amount_usd}/year PHEV</strong>
            . Added to total operating cost.
          </li>
          <li>
            Federal IRA $7,500 tax credit: shown when the vehicle is flagged
            eligible in our catalog and MSRP is under the $55k car / $80k
            SUV/truck cap. We assume buyers take the point-of-sale option.
          </li>
          <li>
            PHEVs: assumed 65% of miles on electric, 35% on gas (industry
            average from INL/Argonne fleet data).
          </li>
          <li>
            WV grid CO₂ factor: 0.67 kg/kWh (EIA state profile — WV is heavily
            coal-fired, so EV emissions here are higher than the US average).
          </li>
          <li>
            These are honest estimates, not professional financial advice.
            Rebate and rate data in the site is updated quarterly.
          </li>
        </ul>
      </details>
    </section>
  );
}

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  decimals = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  hint?: string;
  decimals?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        min={min}
        max={max}
        step={step}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-ink shadow-sm focus:border-brand focus:ring-brand"
      />
      {hint && <span className="text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-ink shadow-sm focus:border-brand focus:ring-brand bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function powertrainLabel(p: string): string {
  switch (p) {
    case "bev":
      return "Electric";
    case "phev":
      return "Plug-in hybrid";
    case "hybrid":
      return "Hybrid";
    default:
      return p.toUpperCase();
  }
}
