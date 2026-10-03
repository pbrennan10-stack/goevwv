// Run with: npm test  (compiles lib/ + tests/ with tsc, then node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../lib/calc";
import { getBackupPower, getChecklists, getFederalData, getIceVehicles, getOwnershipAssumptions, getUtilities, getVehicles } from "../lib/data";
import { backupDays, backupOptions, fmtDays, makerDays } from "../lib/backup";
import { planHousehold, shoppingModels, shortName, tippingPoints, usedBreakEvenPrice, usedShoppingList, type Catalog, type HouseholdInput } from "../lib/household";
import { TRIP_PRESETS, decodeState, encodeState, initialState, sanitizeLoaded } from "../lib/planState";
import { derivePlan, rangeWords, shareText, shareTitle, verdict, verdictFromLink, verdictSentence } from "../lib/planVerdict";
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

test("buying used at the break-even price ties the target (the two used answers agree)", () => {
  const h = household();
  const r = planHousehold(h, cat);
  for (const target of [r.today.totalOverPeriod, r.gasAlt!.totalOverPeriod]) {
    const p = usedBreakEvenPrice(r.plan!, target, h, cat);
    assert.ok(p != null && p > 0 && p < 36795 * 3, `break-even ${p}`);
    const used = planHousehold(household({ candidate: { ...h.candidate!, price: p, used: { odometer: "under_50k" } } }), cat);
    assert.ok(close(used.plan!.totalOverPeriod, target, 0.001), `${used.plan!.totalOverPeriod} vs ${target}`);
  }
});

test("a used EV: tax after trade-in, resale from what you pay, insured at its price, upkeep by miles", () => {
  const h = household();
  const price = 25000;
  const at = (odometer: "under_50k" | "over_100k") =>
    planHousehold(household({ candidate: { ...h.candidate!, price, used: { odometer } } }), cat).plan!;
  const low = at("under_50k"), high = at("over_100k");
  const u = low.units.find((x) => x.unit.isNew)!;
  const own = cat.own;
  const tax = (price - 15000) * own.wv_purchase_tax.rate + own.wv_purchase_tax.title_fee_usd; // $15k trade-in
  const resale = price * Math.pow(1 - own.used_vehicle_annual_depreciation, h.years);
  assert.equal(u.unit.usedOdometer, "under_50k");
  assert.ok(close(u.capitalOverPeriod, price + tax + (low.charging?.setupUsd ?? 0) - resale, 0.0001), u.capitalNote);
  assert.ok(close(low.upfrontCash, price + tax + (low.charging?.setupUsd ?? 0) - 15000, 0.0001));
  const newUnit = planHousehold(h, cat).plan!.units.find((x) => x.unit.isNew)!;
  assert.ok(u.insurance < newUnit.insurance, "insured at its lower value");
  assert.ok(high.units.find((x) => x.unit.isNew)!.maintenance > u.maintenance, "more miles, more upkeep");
  assert.ok(!u.unit.name.startsWith("2"), "a used one's model year isn't known, so the name leaves it off");
});

test("the gas alternative can be bought used, by the same rules", () => {
  const h = household();
  const price = 22000;
  const r = planHousehold(household({ gasAlternative: { ...h.gasAlternative!, price, used: { odometer: "under_50k" } } }), cat);
  const g = r.gasAlt!.units.find((x) => x.unit.isNew)!;
  const own = cat.own;
  const tax = (price - 15000) * own.wv_purchase_tax.rate + own.wv_purchase_tax.title_fee_usd;
  assert.ok(close(g.capitalOverPeriod, price + tax - price * Math.pow(1 - own.used_vehicle_annual_depreciation, h.years), 0.0001), g.capitalNote);
  assert.ok(r.gasAlt!.totalOverPeriod < planHousehold(h, cat).gasAlt!.totalOverPeriod, "skips the steepest part of the value drop");
});

test("used picks survive a share link; malformed ones are dropped", () => {
  const good = { candUsed: { price: 24000, odometer: "50k_100k" as const }, gasUsed: { price: null, odometer: "under_50k" as const } };
  const back = sanitizeLoaded(decodeState(encodeState(good)), cat)!;
  assert.deepEqual(back.candUsed, good.candUsed);
  assert.deepEqual(back.gasUsed, good.gasUsed);
  const bad = { candUsed: { price: -5, odometer: "under_50k" }, gasUsed: { price: 1000, odometer: "lots" } };
  assert.equal(sanitizeLoaded(bad as unknown as Parameters<typeof sanitizeLoaded>[0], cat), null);
});

test("short names keep the make when the model is only a number", () => {
  assert.equal(shortName({ make: "Polestar", model: "2" }), "Polestar 2");
  assert.equal(shortName({ make: "Ram", model: "1500" }), "Ram 1500");
  assert.equal(shortName({ make: "Chevrolet", model: "Equinox EV" }), "Equinox EV");
});

test("charging at work: free is cheapest, paid starts at the business rate, gas-only 'today' is unchanged", () => {
  const at = (workCharging: "none" | "free" | "paid", workCentsPerKwh?: number) =>
    planHousehold(household({ drivers: [{ id: 1, commuteOneWayMi: 21, daysPerWeek: 5, workCharging, ...(workCentsPerKwh != null ? { workCentsPerKwh } : {}) }] }), cat);
  const none = at("none"), free = at("free"), paid = at("paid"), pricey = at("paid", 30);
  const ev = (r: ReturnType<typeof planHousehold>) => r.plan!.units.find((u) => u.unit.isNew)!.energy;
  const biz = cat.fed.calculation_notes.commercial_rate_per_kwh!;
  assert.ok(biz.current < cat.utilities.find((u) => u.id === "aep")!.residential.flat_rate_per_kwh, "WV business rate is below AEP's home rate");
  assert.ok(ev(free) < ev(paid) && ev(paid) < ev(none), `free ${ev(free)} < paid ${ev(paid)} < none ${ev(none)}`);
  assert.ok(close(ev(pricey), ev(none), 0.0001), "a work price above the home rate: you'd charge at home");
  assert.ok(close(free.today.totalOverPeriod, none.today.totalOverPeriod, 0.0001), "a gas-only household doesn't change");
  const back = sanitizeLoaded(decodeState(encodeState({ drivers: [{ id: 1, commuteOneWayMi: 21, daysPerWeek: 5, workCharging: "paid", workCentsPerKwh: 9.5 }] })), cat)!;
  assert.equal(back.drivers![0].workCentsPerKwh, 9.5, "an entered employer price survives a share link");
});

test("without home charging, paying to charge at work beats public chargers", () => {
  const at = (workCharging: "none" | "paid") =>
    planHousehold(household({ homeCharging: "none", drivers: [{ id: 1, commuteOneWayMi: 21, daysPerWeek: 5, workCharging }] }), cat).plan!;
  assert.ok(at("paid").runningPerYear < at("none").runningPerYear);
});

test("a plug-in hybrid charged at home and at work burns less gas", () => {
  const phev = cat.evs.find((v) => v.powertrain === "phev" && v.status === "current" && (v.epa_range_mi_electric ?? 0) > 0)!;
  const at = (workCharging: "none" | "paid") => planHousehold(household({
    candidate: { ref: `ev:${phev.id}`, price: 40000, replaces: "a" },
    drivers: [{ id: 1, commuteOneWayMi: 40, daysPerWeek: 5, workCharging }],
  }), cat).plan!.units.find((u) => u.unit.isNew)!;
  assert.ok(at("paid").energy < at("none").energy, `${phev.id}: a second battery a day replaces gas miles`);
});

test("charging at work survives a share link; unknown values are dropped", () => {
  const drivers = [{ id: 1, commuteOneWayMi: 20, daysPerWeek: 5, workCharging: "free" as const }, { id: 2, commuteOneWayMi: 10, daysPerWeek: 3 }];
  assert.deepEqual(sanitizeLoaded(decodeState(encodeState({ drivers })), cat)!.drivers, drivers);
  const bad = { drivers: [{ id: 1, commuteOneWayMi: 20, daysPerWeek: 5, workCharging: "sometimes" }] };
  assert.deepEqual(sanitizeLoaded(bad as unknown as Parameters<typeof sanitizeLoaded>[0], cat)!.drivers, [{ id: 1, commuteOneWayMi: 20, daysPerWeek: 5 }]);
});

test("used shopping list: planning a listed model used at its number ties the comparison", () => {
  const h = household();
  const models = shoppingModels(cat, h.candidate!.ref);
  assert.ok(!models.some((v) => v.class === "van"), "no cargo vans");
  assert.ok(!models.some((v) => `ev:${v.id}` === h.candidate!.ref), "not the EV already being tried");
  const { rows } = usedShoppingList(h, cat, models);
  assert.ok(rows.length > 5, `${rows.length} rows`);
  const target = planHousehold(h, cat).gasAlt!.totalOverPeriod;
  const row = rows.find((r) => r.maxUsedPrice != null && r.maxUsedPrice < r.newPrice * 3 - 1)!;
  const used = planHousehold(household({ candidate: { ref: `ev:${row.vehicle.id}`, price: row.maxUsedPrice!, replaces: "a", used: { odometer: "under_50k" } } }), cat);
  assert.equal(used.plan!.unassigned.length, 0, "a listed model can do every drive");
  assert.ok(close(used.plan!.totalOverPeriod, target, 0.001), `${row.vehicle.id}: ${used.plan!.totalOverPeriod} vs ${target}`);
});

test("used shopping list only lists models that can do every drive (a 5,000-lb tow)", () => {
  const h = household({ trips: TRIP_PRESETS.filter((t) => t.id === "tow").map((t) => ({ ...t, on: true })) });
  const { rows, cantFit } = usedShoppingList(h, cat, shoppingModels(cat, h.candidate!.ref));
  assert.ok(rows.length > 0 && cantFit > 0, `${rows.length} listed, ${cantFit} can't`);
  for (const r of rows) assert.ok((r.vehicle.towing_lbs ?? 0) >= 5000, `${r.vehicle.id} tows ${r.vehicle.towing_lbs}`);
});

test("data: backup power entries name real vehicles, label confidence, and the math reads right", () => {
  const backup = getBackupPower();
  const ids = new Set(cat.evs.map((v) => v.id));
  for (const e of [...backup.transfer_switch, ...backup.v2h]) {
    for (const id of e.ids) assert.ok(ids.has(id), `backup_power: unknown vehicle ${id}`);
    assert.ok(e.confidence === "verified" || e.confidence === "approximate", `${e.ids[0]} confidence`);
    assert.ok(e.cost && e.source && e.retrieved, `${e.ids[0]} cost/source/retrieved`);
    for (const id of Object.keys(e.maker_runtime_days ?? {})) assert.ok(e.ids.includes(id), `runtime for ${id} not in ids`);
  }
  assert.ok(backup.usable_share > 0.5 && backup.usable_share <= 1 && backup.essentials_kwh_per_day < backup.typical_home_kwh_per_day);
  const er = cat.evs.find((v) => v.id === "ford-f150-lightning-er-2025")!;
  const lightning = backupOptions(er.id, er.features, backup);
  assert.equal(lightning.best, "v2h");
  assert.ok(lightning.outlet === true && lightning.transferSwitch && lightning.v2h);
  assert.equal(makerDays(er.id, backup), 3);
  assert.equal(fmtDays(backupDays(er.battery_kwh!, backup.typical_home_kwh_per_day, backup)), "about 3½ days");
  for (const e of [...backup.transfer_switch, ...backup.v2h]) for (const id of e.ids) assert.ok(cat.evs.find((v) => v.id === id)!.battery_kwh, `${id} needs battery_kwh for the days math`);
  const ioniq9 = cat.evs.find((v) => v.id === "hyundai-ioniq-9-2026")!;
  assert.equal(backupOptions(ioniq9.id, ioniq9.features, backup).best, null, "no outlet, no hardware: no rung");
  assert.equal(fmtDays(0.5), "under a day");
  assert.equal(fmtDays(1.1), "about a day");
});

test("data: checklist constants are sane", () => {
  const c = getChecklists().electrical;
  assert.ok(c.continuous_load_share > 0.5 && c.continuous_load_share <= 1 && c.dryer_circuit_amps >= 20 && c.dryer_circuit_amps <= 50);
  assert.equal(Math.round(c.dryer_circuit_amps * c.continuous_load_share), 24, "24 amps on a 30-amp dryer circuit");
  assert.ok(c.nec_edition && c.nec_effective && c.sources.length > 0);
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

test("share card: a plan link reproduces the results page's verdict", () => {
  const s = initialState(cat);
  const d = derivePlan(s, cat);
  const eq = cat.evs.find((v) => v.id === "chevy-equinox-ev-2025")!;
  assert.equal(d.input.candidate?.price, eq.msrp_usd + (eq.destination_usd ?? 1500), "new price = MSRP + destination");
  assert.equal(d.input.gasAlternative?.ref, "ice:honda-crv-2024", "the gas comparison defaults to a new one of the replaced vehicle");
  const r = planHousehold(d.input, cat);
  const v = verdict(s, d, r)!;
  assert.ok(close(v.saving, r.gasAlt!.totalOverPeriod - r.plan!.totalOverPeriod, 0), "saving = gas total − EV total");
  assert.ok(close(v.monthlyRunSaving * 12, r.gasAlt!.runningPerYear - r.plan!.runningPerYear, 0), "monthly = running-cost gap / 12");
  assert.equal(v.upfront, r.plan!.upfrontCash);
  assert.match(verdictSentence(v), /^vs\. a new CR-V: the Equinox EV (saves about \$[\d,]+|costs about \$[\d,]+ more) over 5 years$/);
  assert.match(shareTitle(v), /^An Equinox EV (saves about|costs about) .* vs a new CR-V over 5 years$/);
  assert.ok(shareText(v).startsWith("Our household plan: an Equinox EV "), shareText(v));
  assert.ok(shareText(v).includes("vs a new CR-V over 5 years in WV"), shareText(v));
  assert.ok(v.range && v.range.lo <= v.saving + 1 && v.saving <= v.range.hi + 1, "the middle estimate sits inside the resale range");
  assert.deepEqual(verdictFromLink(encodeState(s), cat), v, "the link gives the same verdict as the page");
});

test("share card: used plans show one estimate; unfinished or bad links have no card", () => {
  const used = { ...initialState(cat), candUsed: { price: 24000, odometer: "under_50k" as const } };
  const v = verdictFromLink(encodeState(used), cat)!;
  assert.equal(v.isUsed, true);
  assert.equal(v.range, null, "used resale is a single estimate");
  assert.ok(v.evName.startsWith("used "), v.evName);
  assert.match(rangeWords(v), /^(saves \$[\d,]+|costs \$[\d,]+ more)$/);
  assert.equal(verdictFromLink(encodeState({ ...used, candUsed: { price: null, odometer: "under_50k" } }), cat), null, "no price yet → no card");
  assert.equal(verdictFromLink("not-a-plan", cat), null);
  assert.equal(verdictFromLink(null, cat), null);
  assert.equal(verdictFromLink("A".repeat(7000), cat), null, "oversized links are ignored");
});

test("share card: without a gas vehicle the verdict is against keeping what you have", () => {
  const v = verdictFromLink(encodeState({ ...initialState(cat), gasRef: null }), cat)!;
  assert.equal(v.vsGas, false);
  assert.equal(v.vsToday, null);
  assert.equal(v.priceGap, null);
  assert.match(verdictSentence(v), /^The Equinox EV (saves about|costs about) .* than keeping what you have over 5 years$/);
  assert.ok(verdictFromLink(encodeState({ ...initialState(cat), replaces: null, gasRef: null }), cat), "keeping every vehicle and adding an EV still has a verdict");
  assert.match(shareTitle(verdictFromLink(encodeState({ ...initialState(cat), candUsed: { price: 24000, odometer: "under_50k" } }), cat)!), /^A used Equinox EV /);
});
