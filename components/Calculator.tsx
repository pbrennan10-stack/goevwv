"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  annualIceMaintenance,
  calculate,
  fmtNum,
  fmtUSD,
  fmtUSDsigned,
  type CalcReturn,
} from "@/lib/calc";
import type {
  CalcInput,
  FederalData,
  IceVehicle,
  MaintenanceCosts,
  RouteData,
  Utility,
  Vehicle,
  VehicleResult,
} from "@/lib/types";
import { RouteHelper } from "@/components/RouteHelper";

interface Props {
  vehicles: Vehicle[];
  iceVehicles: IceVehicle[];
  utilities: Utility[];
  federal: FederalData;
  mapboxToken?: string;
}

const DEFAULT_INPUT: Omit<CalcInput, "vehicle_ids"> = {
  daily_round_trip_mi: 30,
  days_per_week: 5,
  utility_id: "aep",
  use_tou: false,
  current: {
    mpg: 25,
    gas_price_per_gal: 3.90,
  },
  apply_winter_derate: true,
  long_trips_per_year: 4,
  long_trip_one_way_mi: 200,
};

export function Calculator({ vehicles, iceVehicles, utilities, federal, mapboxToken }: Props) {
  const [daily, setDaily] = useState(DEFAULT_INPUT.daily_round_trip_mi);
  const [days, setDays] = useState(DEFAULT_INPUT.days_per_week);
  const [utilityId, setUtilityId] = useState(DEFAULT_INPUT.utility_id);
  const [useTOU, setUseTOU] = useState(DEFAULT_INPUT.use_tou);
  const [winter, setWinter] = useState(DEFAULT_INPUT.apply_winter_derate);
  const [mpg, setMpg] = useState(DEFAULT_INPUT.current.mpg);
  const [gasPrice, setGasPrice] = useState(DEFAULT_INPUT.current.gas_price_per_gal);
  const [iceVehicleId, setIceVehicleId] = useState("");
  const [route, setRoute] = useState<RouteData | null>(null);
  // Resolved origin/destination coords from RouteHelper. Kept separate from
  // RouteData (which only carries derived metrics) so we can deep-link to
  // /chargers with real coordinates after the user has their results.
  const [routeCoords, setRouteCoords] = useState<{
    origin: [number, number];
    destination: [number, number];
  } | null>(null);
  const [longTrips, setLongTrips] = useState(DEFAULT_INPUT.long_trips_per_year);
  const [longTripMi, setLongTripMi] = useState(DEFAULT_INPUT.long_trip_one_way_mi ?? 200);
  const [gasSensitivityPrice, setGasSensitivityPrice] = useState(DEFAULT_INPUT.current.gas_price_per_gal);
  const [ownershipPlan, setOwnershipPlan] = useState<"replace" | "keep">("replace");

  // True once the one-time URL-hydration useEffect has run. Gates the URL-sync
  // useEffect so it can't write default state back to the URL before
  // hydration's setState calls have actually landed. Without this, navigating
  // to /calculator with route params causes a brief race where URL sync fires
  // with default closure values and clobbers the incoming params.
  const [hasHydrated, setHasHydrated] = useState(false);

  // Per-card trim preference, keyed by base-trim id → chosen variant id. Lets
  // a single picker card (Tesla Model Y, etc.) display either the Standard or
  // Performance trim without doubling the card count. When the chosen trim
  // changes, we also swap the id in selectedIds so the comparison updates.
  const [trimChoices, setTrimChoices] = useState<Record<string, string>>({});

  // One-stop handler for a trim toggle click. Used by both the picker chip
  // and the in-card chip on the Results row. Updates trim display preference
  // AND swaps the id in selectedIds if any variant in the group was already
  // picked for comparison, so the Results section follows the user's trim choice.
  const swapTrim = useCallback(
    (primaryId: string, groupIds: string[], newActiveId: string) => {
      setTrimChoices((prev) => ({ ...prev, [primaryId]: newActiveId }));
      setSelectedIds((prev) => {
        if (!prev.some((id) => groupIds.includes(id))) return prev;
        return prev.map((id) => (groupIds.includes(id) ? newActiveId : id));
      });
    },
    [],
  );

  // Keep sensitivity slider in sync when user updates the main gas price input.
  useEffect(() => { setGasSensitivityPrice(gasPrice); }, [gasPrice]);

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
    setLongTrips(num("lt", DEFAULT_INPUT.long_trips_per_year));
    setLongTripMi(num("ltm", DEFAULT_INPUT.long_trip_one_way_mi ?? 200));
    const vids = p.get("v");
    if (vids) {
      const ids = vids.split(",").filter(Boolean).slice(0, 3);
      setSelectedIds(ids);
      // If any selected id is a non-primary variant of a group, remember
      // that choice so the picker card displays the correct variant on load.
      const choices: Record<string, string> = {};
      for (const id of ids) {
        const v = vehicles.find((x) => x.id === id);
        if (v?.variant_group && !v.variant_primary) {
          const primary = vehicles.find(
            (x) => x.variant_group === v.variant_group && x.variant_primary,
          );
          if (primary) choices[primary.id] = id;
        }
      }
      if (Object.keys(choices).length > 0) setTrimChoices(choices);
    }
    const iv = p.get("iv");
    if (iv) setIceVehicleId(iv);
    const op = p.get("op");
    if (op === "keep") setOwnershipPlan("keep");

    // Route rehydration — reconstruct RouteData from hf/hs/el URL params.
    // Summary text is regenerated since original address strings aren't persisted.
    const hfStr = p.get("hf");
    if (hfStr != null) {
      const hf = Number(hfStr);
      const hs = num("hs", 55);
      const el = num("el", 0);
      const roundTripMi = num("mi", DEFAULT_INPUT.daily_round_trip_mi);
      if (Number.isFinite(hf)) {
        const elFt = Math.round(el * 3.281);
        const elStr = elFt >= 20 ? ` · ${elFt} ft elevation` : "";
        const speedStr = hf > 0.15 && hs > 62 ? ` · avg ${Math.round(hs)} mph hwy` : "";
        setRoute({
          distance_mi: roundTripMi / 2,
          highway_fraction: hf,
          highway_avg_speed_mph: hs,
          elevation_gain_m: el,
          summary: `${roundTripMi.toFixed(1)} mi round-trip · ${Math.round(hf * 100)}% highway${speedStr}${elStr}`,
        });
      }
    }

    // Origin/destination coordinates — stored as four separate numbers
    // (ox/oy = origin lng/lat, dx/dy = destination lng/lat) so we can deep-link
    // to the charger map even after a URL round-trip.
    const oxStr = p.get("ox");
    const oyStr = p.get("oy");
    const dxStr = p.get("dx");
    const dyStr = p.get("dy");
    if (oxStr && oyStr && dxStr && dyStr) {
      const ox = Number(oxStr);
      const oy = Number(oyStr);
      const dx = Number(dxStr);
      const dy = Number(dyStr);
      if ([ox, oy, dx, dy].every(Number.isFinite)) {
        setRouteCoords({ origin: [ox, oy], destination: [dx, dy] });
      }
    }

    // Must be last so the URL-sync useEffect doesn't fire with stale closure
    // state and overwrite the URL we just read from.
    setHasHydrated(true);
  }, []);

  // Default selected vehicles (picked to be interesting for WV).
  const [selectedIds, setSelectedIds] = useState<string[]>([
    "chevy-equinox-ev-2025",
    "tesla-model-y-2025",
    "chevy-silverado-ev-2025",
  ]);

  const utility = useMemo(
    () => utilities.find((u) => u.id === utilityId) ?? utilities[0],
    [utilities, utilityId],
  );

  const selectedVehicles = useMemo(
    () => vehicles.filter((v) => selectedIds.includes(v.id)),
    [vehicles, selectedIds],
  );

  const selectedIceVehicle = useMemo(
    () => iceVehicles.find((v) => v.id === iceVehicleId) ?? null,
    [iceVehicles, iceVehicleId],
  );

  const handleIceVehicleChange = useCallback((id: string) => {
    setIceVehicleId(id);
    if (id) {
      const v = iceVehicles.find((v) => v.id === id);
      if (v) setMpg(v.mpg_combined);
    }
  }, [iceVehicles]);

  const onRouteFill = useCallback(
    (
      r: RouteData,
      coords: { origin: [number, number]; destination: [number, number] },
    ) => {
      setDaily(Math.round(r.distance_mi * 2)); // one-way → round trip
      setRoute(r);
      setRouteCoords(coords);
    },
    [],
  );

  // Annual miles = commute (daily × days × 52) + long trips (trips × one-way × 2).
  // Must match the formula in calc.ts so maintenance amortization and the
  // "mi/yr" display are consistent across UI and calculations.
  const annual_miles = daily * days * 52 + longTrips * longTripMi * 2;
  const iceMaint: MaintenanceCosts | null = useMemo(
    () => selectedIceVehicle ? annualIceMaintenance(selectedIceVehicle, annual_miles) : null,
    [selectedIceVehicle, annual_miles],
  );

  const out: CalcReturn | null = useMemo(() => {
    if (selectedVehicles.length === 0) return null;
    return calculate(
      {
        daily_round_trip_mi: daily,
        days_per_week: days,
        utility_id: utilityId,
        use_tou: useTOU,
        current: {
          mpg,
          gas_price_per_gal: gasPrice,
          ice_vehicle: selectedIceVehicle ?? undefined,
        },
        apply_winter_derate: winter,
        vehicle_ids: selectedIds,
        route: route ?? undefined,
        long_trips_per_year: longTrips,
        long_trip_one_way_mi: longTripMi,
        ownership_plan: ownershipPlan,
      },
      { vehicles: selectedVehicles, utility, fed: federal },
    );
  }, [daily, days, utilityId, useTOU, winter, mpg, gasPrice, selectedIceVehicle, selectedVehicles, utility, federal, selectedIds, route, longTrips, longTripMi, ownershipPlan]);

  const outSensitivity: CalcReturn | null = useMemo(() => {
    if (selectedVehicles.length === 0) return null;
    return calculate(
      {
        daily_round_trip_mi: daily,
        days_per_week: days,
        utility_id: utilityId,
        use_tou: useTOU,
        current: {
          mpg,
          gas_price_per_gal: gasSensitivityPrice,
          ice_vehicle: selectedIceVehicle ?? undefined,
        },
        apply_winter_derate: winter,
        vehicle_ids: selectedIds,
        route: route ?? undefined,
        long_trips_per_year: longTrips,
        long_trip_one_way_mi: longTripMi,
        ownership_plan: ownershipPlan,
      },
      { vehicles: selectedVehicles, utility, fed: federal },
    );
  }, [daily, days, utilityId, useTOU, winter, mpg, gasSensitivityPrice, selectedIceVehicle, selectedVehicles, utility, federal, selectedIds, route, longTrips, longTripMi, ownershipPlan]);

  // Sync state to URL so results are shareable.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Don't write until we've finished reading URL params on mount, or we'd
    // overwrite the incoming URL with default state before hydration lands.
    if (!hasHydrated) return;
    const p = new URLSearchParams();
    p.set("mi", String(daily));
    p.set("d", String(days));
    p.set("u", utilityId);
    if (useTOU) p.set("tou", "1");
    if (!winter) p.set("w", "0");
    p.set("mpg", String(mpg));
    p.set("gas", String(gasPrice));
    p.set("v", selectedIds.join(","));
    if (longTrips !== DEFAULT_INPUT.long_trips_per_year) p.set("lt", String(longTrips));
    if (longTripMi !== (DEFAULT_INPUT.long_trip_one_way_mi ?? 200)) p.set("ltm", String(longTripMi));
    if (iceVehicleId) p.set("iv", iceVehicleId);
    if (ownershipPlan !== "replace") p.set("op", ownershipPlan);
    if (route) {
      p.set("hf", route.highway_fraction.toFixed(3));
      p.set("hs", String(Math.round(route.highway_avg_speed_mph)));
      p.set("el", String(Math.round(route.elevation_gain_m)));
    }
    if (routeCoords) {
      p.set("ox", routeCoords.origin[0].toFixed(5));
      p.set("oy", routeCoords.origin[1].toFixed(5));
      p.set("dx", routeCoords.destination[0].toFixed(5));
      p.set("dy", routeCoords.destination[1].toFixed(5));
    }
    const newUrl = `${window.location.pathname}?${p.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, [hasHydrated, daily, days, utilityId, useTOU, winter, mpg, gasPrice, selectedIds, longTrips, longTripMi, iceVehicleId, ownershipPlan, route, routeCoords]);

  const toggleVehicle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev; // cap at 3
      return [...prev, id];
    });
  }, []);

  return (
    <div className="space-y-8">
      {/* Section 1: Commute & utility */}
      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 sm:p-7">
        <h2 className="text-lg font-semibold text-ink mb-5">
          Your commute &amp; utility
        </h2>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <NumField
              label="Daily round-trip miles"
              value={daily}
              onChange={(v) => { setDaily(v); setRoute(null); }}
              min={1}
              max={500}
              step={1}
              hint={route ? undefined : "Home to work and back, typical weekday."}
            />
            {route ? (
              <div className="flex items-center gap-2 text-xs text-sky-800 bg-sky-50 rounded-md px-2 py-1 ring-1 ring-sky-200">
                <span className="font-medium">Route:</span> {route.summary}
                <button
                  type="button"
                  onClick={() => setRoute(null)}
                  className="ml-auto text-sky-500 hover:text-sky-700 px-1"
                  aria-label="Clear route"
                >✕</button>
              </div>
            ) : mapboxToken ? (
              <RouteHelper token={mapboxToken} onFill={onRouteFill} />
            ) : null}
          </div>
          <NumField
            label="Days per week you drive it"
            value={days}
            onChange={setDays}
            min={1}
            max={7}
            step={1}
            hint={`= ${fmtNum(daily * days * 52)} miles/year`}
          />
          <NumField
            label="Long road trips per year"
            value={longTrips}
            onChange={setLongTrips}
            min={0}
            max={52}
            step={1}
            hint="e.g., WV → Pittsburgh, DC, Charlotte, Columbus. Used to estimate DC fast charger (DCFC) stops."
          />
          <NumField
            label="Typical one-way distance (mi)"
            value={longTripMi}
            onChange={setLongTripMi}
            min={50}
            max={600}
            step={10}
            hint="Default 200. Adjust for your actual destination (e.g., Charleston→Pittsburgh ≈ 250, Charleston→DC ≈ 350)."
          />

          <SelectField
            label="Your electric utility"
            value={utilityId}
            onChange={setUtilityId}
            options={utilities.map((u) => ({ value: u.id, label: u.name }))}
          />

          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm text-ink py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={useTOU}
                onChange={(e) => setUseTOU(e.target.checked)}
                disabled={!utility.residential.tou_available}
                className="h-4 w-4 rounded accent-brand disabled:opacity-50 shrink-0"
              />
              <span>
                Use time-of-use (TOU) off-peak EV rate
                {!utility.residential.tou_available && (
                  <span className="text-ink-soft"> — not offered by {utility.name}</span>
                )}
                {utility.residential.tou_available && utility.residential.tou_url && (
                  <>
                    {" "}
                    <a
                      href={utility.residential.tou_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-ink-soft underline decoration-dotted underline-offset-2 hover:text-brand"
                    >
                      program details ↗
                    </a>
                  </>
                )}
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-ink py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={winter}
                onChange={(e) => setWinter(e.target.checked)}
                className="h-4 w-4 rounded accent-brand shrink-0"
              />
              <span>Apply WV winter range/efficiency derate (~12%/yr)</span>
            </label>
          </div>
        </div>
      </section>

      {/* Section 2: Current vehicle */}
      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 sm:p-7">
        <h2 className="text-lg font-semibold text-ink mb-5">Your current vehicle</h2>

        {/* Sub-block 1: Identification */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-3">
            Identification
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <SelectField
                label="Pick your vehicle for a full cost comparison"
                value={iceVehicleId}
                onChange={handleIceVehicleChange}
                options={[
                  { value: "", label: "— enter MPG manually below —" },
                  ...[...iceVehicles]
                    .sort(
                      (a, b) =>
                        a.make.localeCompare(b.make) ||
                        a.model.localeCompare(b.model) ||
                        a.year - b.year,
                    )
                    .map((v) => ({
                      value: v.id,
                      label: `${v.make} ${v.model} ${v.trim} — ${v.mpg_combined} mpg`,
                    })),
                ]}
              />
            </div>

            <NumField
              label={selectedIceVehicle ? `MPG — ${selectedIceVehicle.make} ${selectedIceVehicle.model}` : "Your car's MPG (EPA combined)"}
              value={mpg}
              onChange={setMpg}
              min={5}
              max={100}
              step={1}
              hint={
                selectedIceVehicle
                  ? mpg !== selectedIceVehicle.mpg_combined
                    ? `EPA combined: ${selectedIceVehicle.mpg_combined} mpg — you've entered your real-world number.`
                    : "EPA combined. Edit if your real-world MPG differs."
                  : "Or pick your vehicle above to auto-fill."
              }
            />

            {selectedIceVehicle && (
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink">Fuel tank</span>
                <div className="w-full rounded-lg bg-slate-50 ring-1 ring-slate-200 px-3 py-3 text-ink">
                  <span className="font-medium">{selectedIceVehicle.tank_gallons} gal</span>
                </div>
                <span className="text-xs text-ink-soft">
                  ~{fmtNum(Math.round(mpg * selectedIceVehicle.tank_gallons))} mi per tank at {mpg} mpg
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 my-6"></div>

        {/* Sub-block 2: Fuel & ownership plan */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-3">
            Fuel &amp; ownership plan
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <NumField
              label="Gas price ($/gal)"
              value={gasPrice}
              onChange={setGasPrice}
              min={1}
              max={10}
              step={0.05}
              decimals={2}
              hint="WV average ~$3.90 (AAA, April 2026)."
            />
            <SelectField
              label="If you switch to an EV, what happens to this vehicle?"
              value={ownershipPlan}
              onChange={(v) => setOwnershipPlan(v === "keep" ? "keep" : "replace")}
              options={[
                { value: "replace", label: "Sell or trade in when switching" },
                { value: "keep", label: "Keep as a second vehicle" },
              ]}
            />
          </div>
          {ownershipPlan === "keep" && (
            <div className="mt-3 rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3 text-xs text-amber-900">
              <strong>Two-car household note:</strong> the 5-year savings shown below assume you
              fully replace your current vehicle with an EV. If you keep the gas vehicle as a
              second car, its insurance, registration, and reduced-mileage operating costs continue
              alongside the EV — combined household operating cost will be higher than either
              number alone. This is the realistic scenario for many WV buyers keeping a gas truck
              for towing/hauling while commuting on an EV. Full two-car scenario math coming in a
              future update.
            </div>
          )}
        </div>

        {/* Sub-block 3: Annual costs (only when ICE vehicle selected) */}
        {iceMaint && selectedIceVehicle && (
          <>
            <div className="border-t border-slate-200 my-6"></div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-3">
                Annual ownership costs — {selectedIceVehicle.year} {selectedIceVehicle.make} {selectedIceVehicle.model}
              </div>
              <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4">
                {/* Maintenance breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <div className="text-ink-soft text-xs">Oil changes</div>
                    <div className="font-medium text-ink">{fmtUSD(iceMaint.oil_usd)}/yr</div>
                    <div className="text-xs text-ink-soft">{selectedIceVehicle.maintenance.oil_changes_per_year}× at {fmtUSD(selectedIceVehicle.maintenance.oil_change_usd)}</div>
                  </div>
                  <div>
                    <div className="text-ink-soft text-xs">Tires</div>
                    <div className="font-medium text-ink">{fmtUSD(iceMaint.tires_usd)}/yr</div>
                    <div className="text-xs text-ink-soft">amortized at {fmtNum(annual_miles)} mi/yr</div>
                  </div>
                  <div>
                    <div className="text-ink-soft text-xs">Brakes</div>
                    <div className="font-medium text-ink">{fmtUSD(iceMaint.brakes_usd)}/yr</div>
                    <div className="text-xs text-ink-soft">amortized at {fmtNum(annual_miles)} mi/yr</div>
                  </div>
                  <div>
                    <div className="text-ink-soft text-xs">Misc</div>
                    <div className="font-medium text-ink">{fmtUSD(iceMaint.misc_usd)}/yr</div>
                    <div className="text-xs text-ink-soft">filters, wipers, fluids</div>
                  </div>
                </div>

                {/* Insurance + Registration */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm mt-4 pt-4 border-t border-slate-200">
                  <div>
                    <div className="text-ink-soft text-xs">Insurance (est.)</div>
                    <div className="font-medium text-ink">{fmtUSD(selectedIceVehicle.annual_insurance_usd)}/yr</div>
                    <div className="text-xs text-ink-soft">full coverage, 35–45yo WV avg</div>
                  </div>
                  <div>
                    <div className="text-ink-soft text-xs">WV registration</div>
                    <div className="font-medium text-ink">{fmtUSD(federal.wv_state_fees.standard_registration_fee?.amount_usd ?? 0)}/yr</div>
                    <div className="text-xs text-ink-soft">Class A passenger vehicle</div>
                  </div>
                </div>

                {/* Total */}
                <div className="mt-4 pt-4 border-t border-slate-200 flex items-baseline justify-between flex-wrap gap-2">
                  <span className="text-sm font-semibold text-ink">
                    Total ownership costs: {fmtUSD(iceMaint.total_usd + selectedIceVehicle.annual_insurance_usd + (federal.wv_state_fees.standard_registration_fee?.amount_usd ?? 0))}/yr
                  </span>
                  <span className="text-xs text-ink-soft">excludes fuel · included in Results below</span>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Section 3: EV picker */}
      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 sm:p-7">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-ink">
            Pick EVs to compare
          </h2>
          <span className="text-sm text-ink-soft">
            {selectedIds.length}/3 selected
          </span>
        </div>

        <div className="space-y-3">
          {groupedByClass(
            // The picker shows one card per vehicle OR per variant-group
            // (represented by its primary trim). Non-primary members of a
            // group are filtered out and reached via the chip toggle.
            vehicles.filter(
              (v) => !v.variant_group || v.variant_primary,
            ),
          ).map(({ cls, list }) => (
            <details key={cls} open className="rounded-xl ring-1 ring-slate-200 overflow-hidden">
              <summary className="list-none cursor-pointer select-none flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-ink text-sm">
                    {classLabel(cls)}
                  </span>
                  <span className="text-xs text-ink-soft">({list.length})</span>
                </div>
                <span className="text-xs text-ink-soft font-mono">▾ click to collapse</span>
              </summary>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 p-3">
                {list.map((primary) => {
                  // Resolve the group (if any) and the vehicle currently displayed.
                  const variants = primary.variant_group
                    ? vehicles.filter((x) => x.variant_group === primary.variant_group)
                    : [];
                  const activeId = trimChoices[primary.id] ?? primary.id;
                  const active =
                    variants.find((v) => v.id === activeId) ?? primary;
                  const on = selectedIds.includes(active.id);
                  const full = selectedIds.length >= 3 && !on;
                  return (
                    <div
                      key={primary.id}
                      className={[
                        "rounded-xl border transition",
                        on
                          ? "border-brand bg-brand-bg"
                          : "border-slate-200 bg-white hover:border-slate-300",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => toggleVehicle(active.id)}
                        disabled={full}
                        className={[
                          "w-full text-left p-3 rounded-xl",
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
                            <div className="font-medium text-ink text-sm leading-snug">
                              {active.year} {active.make} {active.model}
                            </div>
                            <div className="text-xs text-ink-muted leading-snug">
                              {active.trim} · {powertrainLabel(active.powertrain)} ·{" "}
                              {fmtUSD(active.msrp_usd)}
                              {active.zero_to_sixty_s != null && ` · ${active.zero_to_sixty_s}s`}
                            </div>
                            {rangeLabel(active) && (
                              <div className="text-xs text-ink leading-snug mt-0.5 font-medium">
                                {rangeLabel(active)}
                              </div>
                            )}
                            {active.assembly_location && (
                              <div className="text-xs text-ink-muted leading-snug mt-0.5">
                                {assemblyBadge(active.assembly_country, active.us_canadian_parts_pct)}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                      {variants.length > 1 && (
                        <TrimChips
                          variants={variants}
                          activeId={activeId}
                          onChange={(newId) =>
                            swapTrim(
                              primary.id,
                              variants.map((v) => v.id),
                              newId,
                            )
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      </section>

      {out && outSensitivity && (
        <Results
          out={out}
          utility={utility}
          iceMaint={iceMaint}
          selectedIceVehicle={selectedIceVehicle}
          mpg={mpg}
          gasPrice={gasPrice}
          gasSensitivityPrice={gasSensitivityPrice}
          onSensitivityChange={setGasSensitivityPrice}
          outSensitivity={outSensitivity}
          routeCoords={routeCoords}
          vehicles={vehicles}
          onTrimChange={swapTrim}
        />
      )}

      <Assumptions
        utility={utility}
        winter={winter}
        useTOU={useTOU}
        fed={federal}
        route={route}
        hasIceVehicle={!!selectedIceVehicle}
        highwayAvgSpeedMph={out?.highway_avg_speed_mph}
      />
    </div>
  );
}

function Results({
  out,
  utility,
  iceMaint,
  selectedIceVehicle,
  mpg,
  gasPrice,
  gasSensitivityPrice,
  onSensitivityChange,
  outSensitivity,
  routeCoords,
  vehicles,
  onTrimChange,
}: {
  out: CalcReturn;
  utility: Utility;
  iceMaint: MaintenanceCosts | null;
  selectedIceVehicle: IceVehicle | null;
  mpg: number;
  gasPrice: number;
  gasSensitivityPrice: number;
  onSensitivityChange: (p: number) => void;
  outSensitivity: CalcReturn;
  routeCoords: { origin: [number, number]; destination: [number, number] } | null;
  vehicles: Vehicle[];
  onTrimChange: (primaryId: string, groupIds: string[], newActiveId: string) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-ink">Results</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm text-ink-soft">
            At {fmtNum(out.annual_miles)} mi/yr · rate{" "}
            <strong>{fmtNum(out.rate_per_kwh * 100, 1)}¢/kWh</strong>{" "}
            ({out.rate_mode === "tou" ? "TOU off-peak" : "flat"}) via{" "}
            <strong>{utility.name}</strong>
          </div>
          <ReportLink />
        </div>
      </div>

      {/* Cards grid: baseline (current vehicle) + each EV, side-by-side for comparison */}
      <div className={["grid gap-4 md:grid-cols-2", gridColsFor(out.results.length + 1)].join(" ")}>
        <BaselineCard
          out={out}
          iceMaint={iceMaint}
          iceVehicle={selectedIceVehicle}
          mpg={mpg}
        />
        {out.results.map((r) => {
          // Resolve this vehicle's group (if any) so the card can show a
          // trim-swap toggle and stay in sync with the picker.
          const variants = r.vehicle.variant_group
            ? vehicles.filter((x) => x.variant_group === r.vehicle.variant_group)
            : [];
          const primary = variants.find((v) => v.variant_primary) ?? variants[0];
          return (
            <ResultCard
              key={r.vehicle.id}
              r={r}
              showMaintenance={!!iceMaint}
              iceVehicle={selectedIceVehicle}
              currentAnnualCo2Kg={out.current_annual_co2_kg}
              variants={variants}
              onTrimChange={
                primary
                  ? (newActiveId) =>
                      onTrimChange(
                        primary.id,
                        variants.map((v) => v.id),
                        newActiveId,
                      )
                  : undefined
              }
            />
          );
        })}
      </div>

      <FuelingTimePanel out={out} mpg={mpg} selectedIceVehicle={selectedIceVehicle} />
      <GasSensitivitySlider
        gasPrice={gasPrice}
        sensitivityPrice={gasSensitivityPrice}
        onSensitivityChange={onSensitivityChange}
        out={out}
        outSensitivity={outSensitivity}
      />
      {routeCoords && <ChargerMapCrossLink routeCoords={routeCoords} />}
    </section>
  );
}

// Shown only after the user has both (a) finished the calc (so we're inside
// the Results section) and (b) entered a route via RouteHelper. Sends them to
// the charger map with their drive drawn and an obvious way back to the calc.
function ChargerMapCrossLink({
  routeCoords,
}: {
  routeCoords: { origin: [number, number]; destination: [number, number] };
}) {
  const onClick = () => {
    if (typeof window === "undefined") return;
    const { origin, destination } = routeCoords;
    const params = new URLSearchParams();
    params.set("o", `${origin[0].toFixed(5)},${origin[1].toFixed(5)}`);
    params.set("d", `${destination[0].toFixed(5)},${destination[1].toFixed(5)}`);
    params.set("br", "10");
    // Pass the current calculator URL so /chargers can offer a one-click
    // "back to your calculation" that restores every input.
    params.set(
      "return",
      window.location.pathname + window.location.search,
    );
    window.location.href = `/chargers?${params.toString()}`;
  };
  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 sm:p-7">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <h3 className="text-base font-semibold text-ink mb-1">
            Curious where the chargers are on this route?
          </h3>
          <p className="text-sm text-ink-muted">
            See every WV public charger along your drive — the map highlights
            the ones within a few miles of your path. Your calculation is
            preserved; one click brings you back.
          </p>
        </div>
        <button
          type="button"
          onClick={onClick}
          className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:opacity-90 transition whitespace-nowrap"
        >
          Open route on the charger map →
        </button>
      </div>
    </div>
  );
}

// Tailwind JIT needs class names as literal strings.
function gridColsFor(cardCount: number): string {
  if (cardCount >= 4) return "lg:grid-cols-4";
  if (cardCount === 3) return "lg:grid-cols-3";
  return "lg:grid-cols-2";
}

function BaselineCard({
  out,
  iceMaint,
  iceVehicle,
  mpg,
}: {
  out: CalcReturn;
  iceMaint: MaintenanceCosts | null;
  iceVehicle: IceVehicle | null;
  mpg: number;
}) {
  const hasIce = !!iceMaint && !!iceVehicle;
  const annualTotal = hasIce ? out.current_annual_total_usd : out.current_annual_gas_cost;
  return (
    <article className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 flex flex-col gap-3">
      <header>
        <div className="text-xs uppercase tracking-wider text-ink-soft font-semibold">
          Current baseline
        </div>
        <div className="font-semibold text-ink text-lg leading-tight">
          {iceVehicle ? `${iceVehicle.year} ${iceVehicle.make} ${iceVehicle.model}` : "Your current vehicle"}
        </div>
        <div className="text-sm text-ink-soft">
          {iceVehicle ? `${iceVehicle.trim} · ${iceVehicle.mpg_combined} mpg` : `${mpg} mpg (entered manually)`}
        </div>
      </header>

      <div className="rounded-lg p-3 font-mono text-sm bg-slate-100 text-slate-800">
        <div className="text-xs uppercase tracking-wide opacity-70 mb-0.5">
          Annual total (baseline)
        </div>
        <div className="text-xl font-bold tabular-nums">
          {fmtUSD(annualTotal)}
          <span className="text-xs font-normal opacity-70"> /year</span>
        </div>
        <div className="text-xs opacity-75">
          {fmtUSD(annualTotal * 5)} over 5 yr
        </div>
        {!hasIce && (
          <div className="text-xs opacity-75 mt-1 italic">
            Registration fee not included — pick your vehicle above to add it.
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <Row label="Annual fuel/energy" value={fmtUSD(out.current_annual_gas_cost)} />
        <Row
          label="WV annual fee"
          value={out.current_annual_registration_usd > 0 ? fmtUSD(out.current_annual_registration_usd) : "—"}
          muted
        />
        <Row
          label="Maintenance"
          value={hasIce && iceMaint ? fmtUSD(iceMaint.total_usd) : "—"}
          muted
        />
        <Row
          label="Insurance (est.)"
          value={out.current_annual_insurance_usd > 0 ? fmtUSD(out.current_annual_insurance_usd) : "—"}
          muted
        />
        <Row label="Total /yr" value={fmtUSD(annualTotal)} strong />
        <Row
          label="CO₂ /yr"
          value={`${fmtNum(out.current_annual_co2_kg / 1000, 2)} t`}
        />
        <Row label="MSRP" value="Already owned" muted />
        <Row label="Assembly" value="—" muted />
        <Row label="US/CA parts" value="—" muted />
      </dl>
    </article>
  );
}

function ResultCard({
  r,
  showMaintenance,
  iceVehicle,
  currentAnnualCo2Kg,
  variants = [],
  onTrimChange,
}: {
  r: VehicleResult;
  showMaintenance: boolean;
  iceVehicle?: IceVehicle | null;
  currentAnnualCo2Kg: number;
  variants?: Vehicle[];
  onTrimChange?: (newActiveId: string) => void;
}) {
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
          {r.vehicle.zero_to_sixty_s != null && ` · ${r.vehicle.zero_to_sixty_s}s`}
        </div>
        {variants.length > 1 && onTrimChange && (
          <div className="mt-2 -mx-1">
            <TrimChips
              variants={variants}
              activeId={r.vehicle.id}
              onChange={onTrimChange}
            />
          </div>
        )}
      </header>

      <div
        className={[
          "rounded-lg p-3 font-mono text-sm",
          positive ? "bg-brand-bg text-brand-dark" : "bg-amber-50 text-amber-900",
        ].join(" ")}
      >
        <div className="text-xs uppercase tracking-wide opacity-70 mb-0.5">
          {positive ? "Annual savings" : "Annual extra cost"} vs your current {showMaintenance ? "vehicle" : "gas bill"}
        </div>
        <div className="text-xl font-bold tabular-nums">
          {fmtUSD(Math.abs(savings))}
          <span className="text-xs font-normal opacity-70"> /year</span>
        </div>
        <div className="text-xs opacity-75">
          {fmtUSD(Math.abs(r.five_year_savings_vs_current_usd))} {positive ? "saved" : "more"} over 5 yr
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <Row label="Annual fuel/energy" value={fmtUSD(r.annual_energy_cost_usd)} />
        {r.annual_dcfc_energy_cost_usd > 0 ? (
          <Row
            label={`↳ DCFC (${fmtNum(r.annual_dcfc_kwh, 0)} kWh × $${fmtNum(r.annual_dcfc_energy_cost_usd / Math.max(r.annual_dcfc_kwh, 1), 2)})`}
            value={fmtUSD(r.annual_dcfc_energy_cost_usd)}
            muted
          />
        ) : null}
        <Row
          label="WV annual fee"
          value={r.annual_state_fee_usd > 0 ? fmtUSD(r.annual_state_fee_usd) : "—"}
          muted
        />
        <Row
          label="Maintenance"
          value={showMaintenance && r.annual_maintenance_usd > 0 ? fmtUSD(r.annual_maintenance_usd) : "—"}
          muted
        />
        <Row
          label="Insurance (est.)"
          value={showMaintenance && r.annual_insurance_usd > 0 ? fmtUSD(r.annual_insurance_usd) : "—"}
          muted
        />
        <Row label="Total /yr" value={fmtUSD(r.annual_total_usd)} strong />
        <Row
          label="CO₂ /yr"
          value={`${fmtNum(r.co2_kg_per_year / 1000, 2)} t${currentAnnualCo2Kg > 0 ? ` (−${fmtNum((currentAnnualCo2Kg - r.co2_kg_per_year) / 1000, 2)} vs baseline)` : ""}`}
        />
        <Row
          label="MSRP"
          value={fmtUSD(r.vehicle.msrp_usd)}
        />
        <Row
          label="Assembly"
          value={r.vehicle.assembly_location ?? "—"}
          muted
        />
        <Row
          label="US/CA parts"
          value={
            r.vehicle.us_canadian_parts_pct === undefined
              ? "—"
              : r.vehicle.us_canadian_parts_pct === null
              ? "N/A (exempt)"
              : `${r.vehicle.us_canadian_parts_pct}%`
          }
          muted
        />
      </dl>

      {r.warnings.length > 0 && (
        <ul className="text-xs text-amber-800 bg-amber-50 rounded-md p-2 space-y-1 list-disc list-inside">
          {r.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      {iceVehicle?.class === "truck" && r.vehicle.class === "truck" && (
        <div className="rounded-lg bg-amber-50 ring-1 ring-amber-200 p-3 text-xs text-amber-800 space-y-1.5">
          <div className="font-semibold">Towing significantly cuts EV range</div>
          <p>
            Towing near max capacity typically cuts range 40–50%.
            {r.vehicle.epa_range_mi
              ? ` The ${r.vehicle.model} has a ${r.vehicle.epa_range_mi}-mi EPA range — towing reduces that to roughly ${Math.round(r.vehicle.epa_range_mi * 0.55)} miles.`
              : ""}
            {" "}WV&rsquo;s thin DCFC coverage on I-77 south and rural I-79 requires careful planning for long towing routes.
          </p>
          <p>
            Many WV EV owners keep their gas truck for hauling and use an EV for daily commutes — that often pencils out better than replacing the truck entirely.
          </p>
        </div>
      )}

      <div className="text-xs text-amber-900 bg-amber-50 ring-1 ring-amber-200 rounded-md p-2 leading-snug">
        <strong>Resale:</strong> EVs typically depreciate 50–65% over 5 years nationally. WV has ~1,900 registered EVs — a thin local resale market may mean steeper depreciation. Factor into any long-term financial plan.
      </div>
    </article>
  );
}

function FuelingTimePanel({
  out,
  mpg,
  selectedIceVehicle,
}: {
  out: CalcReturn;
  mpg: number;
  selectedIceVehicle: IceVehicle | null;
}) {
  const iceHrs = out.current_annual_fueling_min / 60;
  const iceName = selectedIceVehicle
    ? `${selectedIceVehicle.year} ${selectedIceVehicle.make} ${selectedIceVehicle.model}`
    : `your current car (${mpg} mpg)`;

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 sm:p-7">
      <h3 className="text-base font-semibold text-ink mb-1">
        Time spent fueling vs. charging
      </h3>
      <p className="text-xs text-ink-soft mb-4">
        Based on {out.long_trips_per_year} long road trip{out.long_trips_per_year !== 1 ? "s" : ""}/yr at ~{out.long_trip_one_way_mi} mi one-way.
        Uses each EV&rsquo;s <strong>realistic sustained highway range</strong> (not EPA) — Tesla&rsquo;s EPA
        numbers in particular overstate real-world WV highway range considerably.{" "}
        <strong>DC fast charger (DCFC)</strong> stops cap at ~80% SoC (past that the taper is
        painfully slow), but the model only charges the kWh your specific trip actually needs —
        a short top-up isn&rsquo;t modeled as a full 10→80% fill. Each DCFC stop time includes
        ~4 min of plug-in, authentication, and unplug overhead; winter charging is ~8% slower
        on average across 4 cold months. Home charging is passive; DCFC stops and PHEV gas
        fill-ups are active waiting time.
      </p>

      {/* ICE baseline */}
      <div className="mb-4 rounded-xl bg-amber-50 ring-1 ring-amber-200 p-4 flex flex-wrap items-center gap-x-6 gap-y-1">
        <div>
          <div className="text-xs text-amber-700 font-semibold uppercase tracking-wider mb-0.5">
            {iceName} — gas
          </div>
          <div className="text-2xl font-bold text-amber-900 tabular-nums">
            {fmtNum(iceHrs, 1)} hrs/yr
          </div>
          <div className="text-xs text-amber-700">
            {fmtNum(out.current_annual_fillups, 0)} fill-ups × ~5 min each · all active standing time
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {out.results.map((r) => (
          <ChargingCard key={r.vehicle.id} r={r} iceHrs={iceHrs} />
        ))}
      </div>
    </div>
  );
}

function ChargingCard({ r, iceHrs }: { r: VehicleResult; iceHrs: number }) {
  const isBev = r.vehicle.powertrain === "bev";
  const isPhev = r.vehicle.powertrain === "phev";

  // Active waiting time: DCFC for BEVs, gas fill-ups for PHEVs
  const activeMin = r.annual_dcfc_min + r.annual_gas_fueling_min;
  const activeHrs = activeMin / 60;
  const savedHrs = iceHrs - activeHrs;

  return (
    <article className="rounded-xl ring-1 ring-slate-200 p-4 flex flex-col gap-3">
      <div>
        <div className="text-xs text-ink-soft font-semibold uppercase tracking-wider">
          {r.vehicle.year} {r.vehicle.make}
        </div>
        <div className="text-sm font-semibold text-ink leading-tight">
          {r.vehicle.model} · {powertrainLabel(r.vehicle.powertrain)}
        </div>
      </div>

      {/* Home charging — passive */}
      {(isBev || isPhev) && (
        <div className="rounded-lg bg-brand-bg p-3">
          <div className="text-xs text-brand-dark font-medium mb-0.5">
            Home charging — passive
          </div>
          <div className="text-sm font-semibold text-ink">
            {r.annual_home_charge_sessions} sessions/yr
          </div>
          <div className="text-xs text-ink-muted">
            ~{fmtNum(r.annual_home_charge_min, 0)} min total · plug in &amp; walk away
          </div>
        </div>
      )}

      {/* Active waiting time */}
      {isBev && (
        <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 p-3">
          <div className="text-xs text-ink-soft font-medium mb-0.5">
            Road trip fast charging — active
          </div>
          {r.annual_dcfc_stops === 0 ? (
            <div className="text-sm font-semibold text-brand-dark">
              0 stops — drives through on one charge
            </div>
          ) : (
            <>
              <div className="text-sm font-semibold text-ink">
                {r.annual_dcfc_stops} DCFC stop{r.annual_dcfc_stops !== 1 ? "s" : ""}/yr
              </div>
              <div className="text-xs text-ink-soft">
                ~{fmtNum(r.annual_dcfc_min / 60, 1)} hrs/yr at the charger
              </div>
            </>
          )}
        </div>
      )}

      {isPhev && (
        <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 p-3">
          <div className="text-xs text-ink-soft font-medium mb-0.5">
            Gas fill-ups (35% gas miles) — active
          </div>
          <div className="text-sm font-semibold text-ink">
            {fmtNum(r.annual_gas_fillups, 1)} fill-ups/yr
          </div>
          <div className="text-xs text-ink-soft">
            ~{fmtNum(r.annual_gas_fueling_min / 60, 1)} hrs/yr · road trips use gas (no DCFC stops)
          </div>
        </div>
      )}

      {/* Net vs ICE */}
      <div
        className={[
          "rounded-lg p-3 text-sm font-semibold",
          savedHrs >= 0 ? "bg-brand-bg text-brand-dark" : "bg-amber-50 text-amber-900",
        ].join(" ")}
      >
        {savedHrs >= 0
          ? `Saves ~${fmtNum(savedHrs, 1)} hrs/yr of active fueling time`
          : `~${fmtNum(-savedHrs, 1)} more hrs/yr of active time than gas`}
      </div>
    </article>
  );
}

function GasSensitivitySlider({
  gasPrice,
  sensitivityPrice,
  onSensitivityChange,
  out,
  outSensitivity,
}: {
  gasPrice: number;
  sensitivityPrice: number;
  onSensitivityChange: (p: number) => void;
  out: CalcReturn;
  outSensitivity: CalcReturn;
}) {
  const atBase = Math.abs(sensitivityPrice - gasPrice) < 0.01;
  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 p-5 sm:p-7">
      <h3 className="text-base font-semibold text-ink mb-1">What if gas prices change?</h3>
      <p className="text-xs text-ink-soft mb-4">
        WV gas is currently ${gasPrice.toFixed(2)}/gal. Drag to see how your savings shift.
      </p>
      <div className="flex items-center gap-3 mb-5">
        <span className="text-xs text-ink-soft shrink-0">$2.00</span>
        <input
          type="range"
          min={2.0}
          max={6.0}
          step={0.05}
          value={sensitivityPrice}
          onChange={(e) => onSensitivityChange(Number(e.target.value))}
          className="flex-1 accent-brand"
        />
        <span className="text-xs text-ink-soft shrink-0">$6.00</span>
        <span className="text-sm font-bold text-ink w-16 text-right shrink-0">
          ${sensitivityPrice.toFixed(2)}/gal
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {outSensitivity.results.map((r, i) => {
          const base = out.results[i];
          const delta5yr = r.five_year_savings_vs_current_usd - base.five_year_savings_vs_current_usd;
          return (
            <div key={r.vehicle.id} className="rounded-xl ring-1 ring-slate-200 p-3">
              <div className="text-xs text-ink-soft font-medium leading-snug mb-1">
                {r.vehicle.year} {r.vehicle.make} {r.vehicle.model}
              </div>
              <div className="text-base font-semibold text-ink tabular-nums">
                {fmtUSDsigned(r.five_year_savings_vs_current_usd)}
                <span className="text-xs font-normal text-ink-soft"> 5-yr savings</span>
              </div>
              {!atBase && Math.abs(delta5yr) > 10 ? (
                <div
                  className={`text-xs tabular-nums mt-0.5 ${delta5yr >= 0 ? "text-brand-dark" : "text-amber-700"}`}
                >
                  {fmtUSD(Math.abs(delta5yr))} {delta5yr >= 0 ? "more savings" : "less savings"} vs your current estimate
                </div>
              ) : (
                atBase && (
                  <div className="text-xs text-ink-soft mt-0.5">Move slider to see impact</div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
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
      <dt className={["text-ink-soft", muted ? "opacity-70" : "", className].join(" ")}>
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

// Contextual pointer to the selected utility's active EV programs — rebates and
// TOU tariff. Lives inside the collapsed Assumptions accordion so it never
// pulls focus from the calculator; shown only when the utility actually has
// something to link to, so it silently no-ops for Mon Power and coops.
function UtilityProgramsNote({ utility }: { utility: Utility }) {
  const rebates = utility.rebates ?? [];
  const touUrl = utility.residential.tou_url;
  const touName = utility.residential.tou_program_name;
  if (rebates.length === 0 && !touUrl) return null;
  return (
    <li>
      <strong>{utility.name} EV programs</strong> (not included in the savings
      math — apply separately):
      <ul className="mt-1 ml-5 list-disc space-y-1">
        {rebates.map((r) => (
          <li key={r.id}>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-brand"
            >
              {r.name}
              {r.amount_usd != null && <> — up to ${r.amount_usd}</>} ↗
            </a>
          </li>
        ))}
        {touUrl && (
          <li>
            <a
              href={touUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-brand"
            >
              {touName ?? "Off-peak EV rate"} — program details ↗
            </a>
          </li>
        )}
      </ul>
    </li>
  );
}

function Assumptions({
  utility,
  winter,
  useTOU,
  fed,
  route,
  hasIceVehicle,
  highwayAvgSpeedMph,
}: {
  utility: Utility;
  winter: boolean;
  useTOU: boolean;
  fed: FederalData;
  route: RouteData | null;
  hasIceVehicle: boolean;
  highwayAvgSpeedMph?: number;
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
                ? `TOU off-peak rate: ${fmtNum(
                    (utility.residential.tou_schedule?.off_peak_rate_per_kwh ?? 0) * 100,
                    1,
                  )}¢/kWh (100% off-peak charging assumed)`
                : `flat ${fmtNum(utility.residential.flat_rate_per_kwh * 100, 1)}¢/kWh`}
            </strong>
          </li>
          <li>
            {route ? (
              <>
                City/highway efficiency: blended from your actual route (
                <strong>{Math.round(route.highway_fraction * 100)}% highway</strong>).
                EVs use more energy at highway speeds due to aerodynamic drag — opposite of gas cars.
                {route.elevation_gain_m > 5 && (
                  <> Elevation change: <strong>{Math.round(route.elevation_gain_m * 3.281)} ft</strong> one-way.
                  Energy for climbing is ~70% recovered via regenerative braking on the way down.</>
                )}
              </>
            ) : (
              <>
                City/highway efficiency: blended at the EPA default split (55% city / 45% highway)
                using each vehicle&rsquo;s separate EPA city and highway ratings.
                Use the &ldquo;calculate from route&rdquo; option for a commute-specific estimate.
              </>
            )}
          </li>
          {route && (highwayAvgSpeedMph ?? 55) > 62 && (
            <li>
              Speed correction: your route averages{" "}
              <strong>{Math.round(highwayAvgSpeedMph!)} mph on highway segments</strong>.
              At that speed EV energy use is roughly{" "}
              <strong>
                {Math.round(((0.60 + 0.40 * Math.pow(highwayAvgSpeedMph! / 55, 2)) - 1) * 100)}% higher
              </strong>{" "}
              than the EPA highway test (55 mph) because aerodynamic drag scales with the square of speed.
              This is already factored into the energy cost shown above.
            </li>
          )}
          <li>
            Winter derate: <strong>{winter ? "on" : "off"}</strong>. When on we
            add ~12% to annual kWh to reflect 4 cold-weather months with ~28%
            range loss from heaters and battery chemistry. Winter also slows
            DCFC by ~25% when the battery is cold; we bake in an 8% annualized
            charge-time uplift when this toggle is on.
          </li>
          <li>
            <strong>DCFC (public fast charging) rate:</strong>{" "}
            <strong>${fed.calculation_notes.dcfc_rate_per_kwh?.current.toFixed(2) ?? "0.48"}/kWh</strong>{" "}
            for long-trip kWh. Matches Electrify America&rsquo;s Pass (non-member)
            rate, the dominant public network on WV&rsquo;s interstates.
            Home-charged kWh stay at your utility rate. DCFC energy and time scale
            to what the trip actually needs — a short top-up to reach your destination
            isn&rsquo;t modeled as a full 10→80% charge. Each stop adds ~4 min of
            plug-in, authentication, and unplug overhead beyond the charging window.
            Members of EA Pass+ or EVgo+ pay meaningfully less; this is the walk-up default.
          </li>
          <li>
            WV EV road fee:{" "}
            <strong>${fed.wv_state_fees.bev_annual_fee.amount_usd}/year BEV, ${fed.wv_state_fees.phev_annual_fee.amount_usd}/year PHEV</strong>.
            Added to total operating cost.
          </li>
          <li>
            Federal EV tax credit (IRC 30D): <strong>repealed in 2025</strong>{" "}
            and not included in these estimates.
          </li>
          <UtilityProgramsNote utility={utility} />
          {hasIceVehicle && (
            <li>
              Maintenance comparison: ICE costs use vehicle-specific data (oil
              changes, tires, brakes, misc). EV costs use class-based estimates —
              no oil changes, ~70% lower brake costs from regenerative braking,
              similar tire costs, $100/yr misc (cabin filter + wipers only).
              Numbers are WV-area averages; actual costs vary by shop and driving habits.
            </li>
          )}
          {hasIceVehicle && (
            <li>
              Insurance: ICE estimate is from vehicle data (full coverage, 35–45 year old WV driver with a clean record).
              EV insurance is estimated by vehicle class at 15–25% above comparable ICE due to higher parts and repair costs.
              Your actual rate will vary based on driving history, coverage level, and ZIP code — get a real quote before deciding.
            </li>
          )}
          <li>
            PHEVs: assumed 65% of miles on electric, 35% on gas (industry
            average from INL/Argonne fleet data).
          </li>
          <li>
            WV grid CO₂ factor: 0.67 kg/kWh (EIA state profile). WV is part of
            the <strong>PJM Interconnection</strong> — the grid serving 13 states
            plus DC. PJM&rsquo;s actual fuel mix is more diverse than WV&rsquo;s
            in-state generation: roughly 40% gas, 22% nuclear, 18% coal, and
            17%+ wind/solar/hydro from neighboring states. When PJM dispatches
            gas or nuclear instead of coal, your EV&rsquo;s real-time emissions
            drop. The 0.67 kg/kWh figure reflects WV&rsquo;s heavy coal exports
            and is the conservative assumption; the actual PJM marginal factor
            at night (when most EVs charge) is typically lower.{" "}
            <strong>
              As the grid adds renewables, EV emissions fall automatically —
              a gas car&rsquo;s emissions never change.
            </strong>
          </li>
          <li>
            Five-year totals are in <strong>constant 2026 dollars</strong> — we
            don&rsquo;t apply inflation. Gas and electric rates historically move
            together, so the relative comparison stays roughly stable. Battery
            degradation is minor in the first 5 years (most manufacturer warranties
            guarantee 70%+ capacity at 8 years / 100k mi).
          </li>
          <li>
            These are honest estimates, not professional financial advice.
            Rebate and rate data reviewed quarterly.
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
  // Local draft state so the user can transiently empty the field while typing
  // (e.g. clear "30" to type "150") without React snapping it back to "0".
  const [draft, setDraft] = useState<string>(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        type="number"
        value={draft}
        onChange={(e) => {
          const s = e.target.value;
          setDraft(s);
          if (s === "") return; // user is mid-edit; don't commit yet
          const n = Number(s);
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => {
          if (draft === "" || !Number.isFinite(Number(draft))) {
            setDraft(String(value)); // snap back to last valid value
          }
        }}
        min={min}
        max={max}
        step={step}
        className="w-full rounded-lg border border-slate-300 px-3 py-3 text-ink shadow-sm focus:border-brand focus:ring-brand"
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
        className="w-full rounded-lg border border-slate-300 px-3 py-3 text-ink shadow-sm focus:border-brand focus:ring-brand bg-white"
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

function ReportLink() {
  // Uses the live URL — Calculator keeps search params in sync with state.
  const onClick = () => {
    if (typeof window === "undefined") return;
    window.open(`/report${window.location.search}`, "_blank", "noopener");
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-medium text-brand hover:underline whitespace-nowrap"
    >
      Printable report →
    </button>
  );
}

function powertrainLabel(p: string): string {
  switch (p) {
    case "bev":    return "Electric";
    case "phev":   return "Plug-in hybrid";
    case "hybrid": return "Hybrid";
    default:       return p.toUpperCase();
  }
}

const CLASS_ORDER: Vehicle["class"][] = ["truck", "suv", "sedan", "hatchback", "minivan", "other"];
const CLASS_LABELS: Record<Vehicle["class"], string> = {
  truck: "Trucks",
  suv: "SUVs",
  sedan: "Sedans",
  hatchback: "Hatchbacks",
  minivan: "Minivans",
  other: "Other",
};

function classLabel(c: Vehicle["class"]): string {
  return CLASS_LABELS[c] ?? c;
}

function groupedByClass(vehicles: Vehicle[]): Array<{ cls: Vehicle["class"]; list: Vehicle[] }> {
  const buckets = new Map<Vehicle["class"], Vehicle[]>();
  for (const v of vehicles) {
    if (!buckets.has(v.class)) buckets.set(v.class, []);
    buckets.get(v.class)!.push(v);
  }
  for (const list of buckets.values()) {
    list.sort(
      (a, b) =>
        a.make.localeCompare(b.make) ||
        a.model.localeCompare(b.model) ||
        a.year - b.year,
    );
  }
  return CLASS_ORDER.filter((c) => buckets.has(c)).map((c) => ({ cls: c, list: buckets.get(c)! }));
}

// Pill-style toggle for swapping between trims within a variant group
// (Standard / Long Range / Performance / Large Pack, etc.). Kept visually
// subtle — a row of compact chips below the main card content.
function TrimChips({
  variants,
  activeId,
  onChange,
}: {
  variants: Vehicle[];
  activeId: string;
  onChange: (newActiveId: string) => void;
}) {
  return (
    <div className="px-3 pb-2 pt-1.5 border-t border-slate-200/70 flex items-center gap-1 flex-wrap">
      {variants.map((v) => {
        const isActive = activeId === v.id;
        const label = v.variant_label ?? v.trim;
        return (
          <button
            key={v.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!isActive) onChange(v.id);
            }}
            className={[
              "rounded px-2 py-0.5 text-[11px] leading-tight transition",
              isActive
                ? "bg-brand text-white font-semibold"
                : "text-ink-soft hover:text-ink hover:bg-slate-100",
            ].join(" ")}
            aria-pressed={isActive}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function rangeLabel(v: Vehicle): string {
  if (v.powertrain === "phev") {
    if (v.epa_range_mi_electric && v.epa_range_mi_total) {
      return `${v.epa_range_mi_electric} mi electric · ${v.epa_range_mi_total} mi total`;
    }
    return "";
  }
  if (v.powertrain === "bev" && v.epa_range_mi) {
    if (v.highway_range_mi) {
      return `${v.epa_range_mi} mi EPA · ~${v.highway_range_mi} mi realistic hwy`;
    }
    return `${v.epa_range_mi} mi EPA`;
  }
  return "";
}

function assemblyBadge(country?: string, pct?: number | null): string {
  const loc = country === "US" ? "🇺🇸 US-assembled"
    : country === "Canada" ? "🇨🇦 Canada-assembled"
    : country === "Mexico" ? "🇲🇽 Mexico-assembled"
    : country === "South Korea" ? "🇰🇷 Korea-assembled"
    : country === "Japan" ? "🇯🇵 Japan-assembled"
    : country === "China" ? "🇨🇳 China-assembled"
    : country ?? "—";
  if (pct === null) return `${loc} · parts content N/A (AALA-exempt)`;
  if (pct === undefined) return loc;
  return `${loc} · ${pct}% US/CA parts`;
}
