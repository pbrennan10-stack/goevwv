// Run with: npm test  (compiles lib/ + tests/ with tsc, then node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../lib/calc";
import { getFederalData, getIceVehicles, getOwnershipAssumptions, getUtilities, getVehicles } from "../lib/data";
import { planHousehold, tippingPoints, usedBreakEvenPrice, type Catalog, type HouseholdInput } from "../lib/household";
import { TRIP_PRESETS, decodeState, encodeState } from "../lib/planState";
import { ASSIST_LABEL, FEATURE_GROUPS } from "../lib/features";

const cat: Catalog = { evs: getVehicles(), ice: getIceVehicles(), utilities: getUtilities(), fed: getFederalData(), own: getOwnershipAssumptions() };
const close = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * tol);

function household(over: Partial<HouseholdInput> = {}): HouseholdInput {
  return {
    owned: [{ key: "a", ref: "ice:honda-crv-2024", valueNow: 15000 }],
    candidate: { ref: "ev:chevy-equinox-ev-2025", price: 36795, replaces: "a" },
    gasAlternative: { ref: "ice:honda-crv-2024", price: 34470 },
    drivers: [{ id: 1, commuteOneWayMi: 21, daysPerWeek: 5 }],
    errandsMiPerWeek: 60, errandsPeople: 3,
    trips: TRIP_PRESETS.filter((t) => t.on),
    utilityId: "aep", useTOU: false, gasPrice: 3.45, years: 5,
    overrides: {}, retention5yOverride: null,
    ...over,
  };
}

test("data: ids unique and core fields present", () => {
  const ids = new Set<string>();
  for (const v of cat.evs) {
    assert.ok(!ids.has(v.id), `duplicate id ${v.id}`); ids.add(v.id);
    assert.ok(v.msrp_usd > 0, `${v.id} msrp`);
    assert.ok(v.efficiency_kwh_per_100mi > 0, `${v.id} efficiency`);
    assert.ok(v.seats >= 1, `${v.id} seats`);
    if (v.powertrain === "bev") {
      assert.ok((v.winter_range_mi ?? 0) > 0 && (v.highway_range_mi ?? 0) > 0, `${v.id} ranges`);
      assert.ok((v.winter_range_mi ?? 0) < (v.epa_range_mi ?? 0) * (v.real_world_range_factor ?? 1) + 1, `${v.id} winter <= EPA`);
    }
  }
  for (const v of cat.ice) {
    assert.ok(!ids.has(v.id), `duplicate id ${v.id}`); ids.add(v.id);
    assert.ok(v.mpg_combined > 5 && v.mpg_combined < 70, `${v.id} mpg`);
    assert.ok(v.maintenance && v.maintenance.oil_change_usd > 0, `${v.id} maintenance`);
    if (v.new_status === "current") assert.ok((v.new_msrp_usd ?? 0) > 10000, `${v.id} new price`);
  }
});

test("data: scenario ranges are ordered low <= mid <= high", () => {
  for (const [k, r] of Object.entries(cat.own.retention_scenarios_5yr)) {
    if (typeof r !== "object" || !("low" in r)) continue;
    assert.ok(r.low <= r.mid && r.mid <= r.high, `retention ${k}`);
  }
  const g = cat.fed.calculation_notes.gas_price_outlook_per_gal!;
  assert.ok(g.low <= g.mid && g.mid <= g.high, "gas outlook");
});

test("calculator and planner agree on a one-car commute", () => {
  const aep = cat.utilities.find((u) => u.id === "aep")!;
  const calc = calculate({
    daily_round_trip_mi: 30, days_per_week: 5, utility_id: "aep", use_tou: false,
    current: { mpg: 25, gas_price_per_gal: 3.45 }, apply_winter_derate: true,
    vehicle_ids: ["chevy-equinox-ev-2025"], long_trips_per_year: 0,
  }, { vehicles: cat.evs.filter((v) => v.id === "chevy-equinox-ev-2025"), utility: aep, fed: cat.fed });
  const plan = planHousehold(household({
    owned: [{ key: "a", ref: "ice:honda-crv-2024", valueNow: 15000, mpgOverride: 25 }],
    drivers: [{ id: 1, commuteOneWayMi: 15, daysPerWeek: 5 }], errandsMiPerWeek: 0, trips: [], years: 1,
    homeCharging: "l1",
  }), cat);
  assert.ok(close(plan.today.units[0].energy, calc.current_annual_gas_cost), `gas ${plan.today.units[0].energy} vs ${calc.current_annual_gas_cost}`);
  const ev = plan.plan!.units.find((u) => u.unit.isNew)!;
  assert.ok(close(ev.energy, calc.results[0].annual_energy_cost_usd), `ev ${ev.energy} vs ${calc.results[0].annual_energy_cost_usd}`);
});

test("winter applies to gas too, not just EVs", () => {
  const aep = cat.utilities.find((u) => u.id === "aep")!;
  const run = (derate: boolean) => calculate({
    daily_round_trip_mi: 30, days_per_week: 5, utility_id: "aep", use_tou: false,
    current: { mpg: 25, gas_price_per_gal: 3.45 }, apply_winter_derate: derate,
    vehicle_ids: [], long_trips_per_year: 0,
  }, { vehicles: [], utility: aep, fed: cat.fed });
  assert.ok(run(true).current_annual_gas_cost > run(false).current_annual_gas_cost);
});

test("better resale means a lower total, and scenarios bracket the middle", () => {
  const r = planHousehold(household(), cat);
  assert.ok(r.range.low.plan! >= r.plan!.totalOverPeriod && r.plan!.totalOverPeriod >= r.range.high.plan!);
  assert.ok(r.range.low.gasAlt! >= r.gasAlt!.totalOverPeriod && r.gasAlt!.totalOverPeriod >= r.range.high.gasAlt!);
});

test("tipping points really are where the EV and gas totals meet", () => {
  const h = household();
  const t = tippingPoints(h, cat);
  if (t.retention5 != null) {
    const r = planHousehold({ ...h, retention5yOverride: t.retention5 }, cat);
    assert.ok(Math.abs(r.plan!.totalOverPeriod - r.gasAlt!.totalOverPeriod) < 50);
  }
  if (t.gasPrice != null) {
    const r = planHousehold({ ...h, gasPrice: t.gasPrice }, cat);
    assert.ok(Math.abs(r.plan!.totalOverPeriod - r.gasAlt!.totalOverPeriod) < 50);
  }
});

test("used break-even price is positive and ties the target", () => {
  const h = household();
  const r = planHousehold(h, cat);
  const p = usedBreakEvenPrice(r.plan!, r.today.totalOverPeriod, h, cat);
  assert.ok(p != null && p > 0 && p < 36795 * 3);
});

test("no home charging costs more than charging at home", () => {
  const home = planHousehold(household({ homeCharging: "l2" }), cat).plan!;
  const none = planHousehold(household({ homeCharging: "none" }), cat).plan!;
  assert.ok(none.runningPerYear > home.runningPerYear);
  assert.equal(none.charging?.mode, "none");
});

test("off-peak EV rate implies a Level 2 charger", () => {
  const r = planHousehold(household({ useTOU: true, homeCharging: "l1" }), cat).plan!;
  assert.equal(r.charging?.mode, "l2");
});

test("share links round-trip, with preset trips stored compactly", () => {
  const trips = TRIP_PRESETS.map((t) => ({ ...t }));
  const code = encodeState({ trips, gasPrice: 3.45 });
  const back = decodeState(code)!;
  assert.deepEqual(back.trips, trips);
  assert.equal(back.gasPrice, 3.45);
  assert.ok(!code.includes("Beach"), "presets should be compact");
});

test("data: equipment facts use known values", () => {
  const levels = new Set(Object.keys(ASSIST_LABEL));
  const ota = new Set(["vehicle_systems", "infotainment_only", "none", "unknown"]);
  for (const v of [...cat.evs, ...cat.ice]) {
    const f = v.features;
    if (!f) continue;
    assert.ok(levels.has(f.driver_assist_level), `${v.id} driver_assist_level ${f.driver_assist_level}`);
    assert.ok(f.ota_updates === undefined || ota.has(f.ota_updates), `${v.id} ota ${f.ota_updates}`);
    assert.ok(f.confidence === "verified" || f.confidence === "approximate", `${v.id} confidence`);
    for (const g of FEATURE_GROUPS) for (const r of g.rows) {
      const x = f[r.key];
      assert.ok(x === undefined || x === null || typeof x === "boolean", `${v.id} ${r.key}`);
    }
  }
});
