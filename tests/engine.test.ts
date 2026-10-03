// Run with: npm test  (compiles lib/ + tests/ with tsc, then node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../lib/calc";
import { getBackupPower, getChecklists, getFederalData, getHouseholdBudget, getIceVehicles, getOwnershipAssumptions, getUtilities, getVehicles } from "../lib/data";
import { cheapestNewEv, tenThousandDollarCar, whatIfCases } from "../lib/tenK";
import { backupDays, backupOptions, fmtDays, makerDays } from "../lib/backup";
import { loanBalance, loanInterest, loanPayment, planHousehold, shoppingModels, shortName, tippingPoints, usedBreakEvenPrice, usedShoppingList, type Catalog, type HouseholdInput } from "../lib/household";
import { TRIP_PRESETS, decodeState, encodeState, initialState, sanitizeLoaded } from "../lib/planState";
import { allInSentence, derivePlan, paymentWords, rangeWords, shareText, shareTitle, verdict, verdictFromLink, verdictSentence } from "../lib/planVerdict";
import { vehicleCardFacts } from "../lib/vehicleCard";
import { costPer100Mi } from "../lib/scenario";
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

test("vehicle share cards say what the page says", () => {
  const backup = getBackupPower();
  const facts = (id: string) => vehicleCardFacts(cat.evs.find((v) => v.id === id)!, cat.fed, cat.utilities, cat.evs, backup);
  const eq = cat.evs.find((v) => v.id === "chevy-equinox-ev-2025")!;
  const f = facts(eq.id);
  assert.equal(f.title, `${eq.year} ${eq.make} ${eq.model}`);
  assert.equal(f.tiles.length, 3);
  assert.equal(f.tiles[0].value, `~${eq.winter_range_mi} mi`, "winter range leads");
  const aep = cat.utilities.find((u) => u.id === "aep")!;
  assert.equal(f.tiles[2].value, `$${costPer100Mi(eq, aep.residential.flat_rate_per_kwh).toFixed(2)}`, "cost per 100 miles matches the page's helper");
  assert.match(f.tiles[2].sub, /^vs \$\d+\.\d\d on gas at 25 mpg$/);
  const phev = cat.evs.find((v) => v.powertrain === "phev" && v.epa_range_mi_electric && v.efficiency_mpg_hybrid)!;
  const pf = facts(phev.id);
  assert.equal(pf.tiles[0].label, "Electric range");
  assert.equal(pf.tiles[1].value, `${phev.efficiency_mpg_hybrid} mpg`);
  const lightning = cat.evs.find((v) => v.model.includes("Lightning"))!;
  assert.match(facts(lightning.id).note ?? "", /^In an outage: about .* of essentials from the battery · /, "backup line for a vehicle with a sourced backup path");
  const gone = cat.evs.find((v) => v.status === "discontinued" && !backup.transfer_switch.some((e) => e.ids.includes(v.id)) && !backup.v2h.some((e) => e.ids.includes(v.id)) && !v.features?.power_outlet_v2l)!;
  assert.equal(facts(gone.id).note, "Discontinued — used market only");
  assert.match(facts(gone.id).subtitle, /last sold new at \$/);
  for (const v of cat.evs) {
    const x = facts(v.id);
    assert.ok(x.tiles.length >= 2 && x.tiles.length <= 3, `${v.id} tiles`);
    assert.ok(x.title.length < 40 && x.subtitle.length < 80, `${v.id} fits the card: ${x.title} / ${x.subtitle}`);
  }
});

test("loans: payment, balance and interest follow standard amortization", () => {
  assert.ok(close(loanPayment(20000, 0.07, 60), 396.02, 0.0001), `${loanPayment(20000, 0.07, 60)}`);
  assert.equal(loanPayment(12000, 0, 60), 200);
  assert.ok(close(loanBalance(20000, 0.07, 60, 60), 0, 0), "paid off at the end");
  assert.ok(close(loanBalance(20000, 0.07, 60, 0), 20000, 0));
  assert.ok(close(loanInterest(20000, 0.07, 60, 60), loanPayment(20000, 0.07, 60) * 60 - 20000, 0.0001), "full-term interest = payments − principal");
  const inside = loanInterest(20000, 0.07, 72, 60), whole = loanInterest(20000, 0.07, 72, 72);
  assert.ok(inside < whole && inside > whole * 0.9, "a 6-year loan sold after 5: most, not all, of the interest is paid");
  assert.equal(loanInterest(0, 0.07, 60, 60), 0);
  assert.equal(loanInterest(20000, 0, 60, 60), 0);
});

test("financing: a 0% loan with nothing down costs the same as cash; otherwise interest joins the total", () => {
  const cash = planHousehold(household(), cat);
  const free = planHousehold(household({ financing: { aprNew: 0, aprUsed: 0, termMonths: 60, cashDown: 0 } }), cat);
  assert.ok(close(free.plan!.totalOverPeriod, cash.plan!.totalOverPeriod, 0), "0% APR ties cash");
  assert.ok(close(free.gasAlt!.totalOverPeriod, cash.gasAlt!.totalOverPeriod, 0));
  const fin = { aprNew: 0.07, aprUsed: 0.106, termMonths: 60, cashDown: 0 };
  const r = planHousehold(household({ financing: fin }), cat);
  const p = r.plan!;
  assert.ok(p.loan && p.interestOverPeriod > 0, "the EV plan has a loan");
  assert.ok(r.gasAlt!.loan && r.gasAlt!.interestOverPeriod > 0, "so does the gas alternative");
  assert.ok(close(p.totalOverPeriod, cash.plan!.totalOverPeriod + p.interestOverPeriod, 0), "financed total = cash total + interest");
  assert.ok(close(p.loan!.amount, p.upfrontCash - (p.charging?.setupUsd ?? 0), 0), "amount financed = price + tax − trade-in; the charger is paid in cash");
  assert.ok(close(p.loan!.payment, loanPayment(p.loan!.amount, 0.07, 60), 0.0001));
  assert.ok(close(p.interestOverPeriod, loanInterest(p.loan!.amount, 0.07, 60, 60), 0.0001));
  assert.equal(r.today.loan, null);
  assert.equal(r.today.interestOverPeriod, 0);
  assert.ok(p.upfrontCash === cash.plan!.upfrontCash, "the cash figure is unchanged");
  const down = planHousehold(household({ financing: { ...fin, cashDown: 5000 } }), cat).plan!;
  assert.ok(close(down.loan!.amount, p.loan!.amount - 5000, 0) && down.interestOverPeriod < p.interestOverPeriod, "cash down shrinks the loan and the interest");
  assert.ok(close(down.loan!.cashAtSigning, 5000 + (down.charging?.setupUsd ?? 0), 0));
  const long = planHousehold(household({ financing: { ...fin, termMonths: 84 } }), cat).plan!;
  assert.ok(close(long.interestOverPeriod, loanInterest(long.loan!.amount, 0.07, 84, 60), 0.0001), "only the interest inside the 5 years counts");
  const used = planHousehold(household({ financing: fin, candidate: { ref: "ev:chevy-equinox-ev-2025", price: 24000, replaces: "a", used: { odometer: "under_50k" } } }), cat).plan!;
  assert.ok(close(used.loan!.apr, 0.106, 0), "a used purchase borrows at the used rate");
});

test("financing: buying used at the break-even price still ties (interest on both sides)", () => {
  const h = household({ financing: { aprNew: 0.07, aprUsed: 0.106, termMonths: 60, cashDown: 1000 } });
  const r = planHousehold(h, cat);
  for (const target of [r.today.totalOverPeriod, r.gasAlt!.totalOverPeriod]) {
    const p = usedBreakEvenPrice(r.plan!, target, h, cat)!;
    assert.ok(p > 0);
    const used = planHousehold(household({ ...h, candidate: { ...h.candidate!, price: p, used: { odometer: "under_50k" } } }), cat);
    assert.ok(close(used.plan!.totalOverPeriod, target, 0.001), `${used.plan!.totalOverPeriod} vs ${target}`);
  }
});

test("financing: the choice survives a share link and the verdict carries the monthly view", () => {
  const s = { ...initialState(cat), finance: { aprPct: null, months: 72, down: 2500 } };
  const back = sanitizeLoaded(decodeState(encodeState(s)), cat)!;
  assert.deepEqual(back.finance, { aprPct: null, months: 72, down: 2500 });
  assert.equal(sanitizeLoaded({ finance: { aprPct: 99, months: 72, down: 0 } }, cat), null, "an impossible APR is dropped");
  assert.equal(sanitizeLoaded({ finance: { aprPct: 6.5, months: 61, down: 0 } }, cat), null, "an odd term is dropped");
  assert.deepEqual(sanitizeLoaded({ finance: null }, cat), { finance: null });
  const v = verdictFromLink(encodeState(s), cat)!;
  const l = v.loan!;
  assert.ok(l && l.months === 72 && l.aprPct === 7 && l.otherPayment != null && l.otherPayment > 0);
  assert.ok(close(l.allIn - l.otherAllIn, l.payment - l.otherPayment! - v.monthlyRunSaving, 0.01), "all-in gap = payment gap − running-cost saving");
  assert.ok(l.todayAllIn < l.allIn, "keeping a paid-off car costs less per month than a payment plus running costs");
  assert.match(paymentWords(v), /^\$[\d,]+ (more|less) a month than a new CR-V$/);
  assert.match(allInSentence(v), /^All in, about \$[\d,]+ a month — the payment plus running costs — vs \$[\d,]+ for a new CR-V and \$[\d,]+ keeping what you have \(assumed paid off\)\. \$[\d,]+ due at signing\.$/);
  const own = verdictFromLink(encodeState({ ...s, finance: { aprPct: 5, months: 60, down: 0 } }), cat)!;
  assert.equal(own.loan!.aprPct, 5, "an entered rate applies");
  assert.equal(verdictFromLink(encodeState(initialState(cat)), cat)!.loan, null, "cash by default");
  const noGas = verdictFromLink(encodeState({ ...s, gasRef: null }), cat)!;
  assert.equal(noGas.loan!.otherPayment, null);
  assert.match(paymentWords(noGas), /^72 months at 7%$/);
});

test("the $10,000-car what-if: sane data, and price is the only thing that changes", () => {
  const b = getHouseholdBudget();
  assert.ok(b.wv_median_household_income.amount_usd > 40000 && b.wv_median_household_income.amount_usd < 90000, "WV median income");
  assert.ok(b.bls_consumer_expenditures.transportation_per_year > 10000 && b.bls_consumer_expenditures.transportation_per_year < 20000);
  assert.ok(b.bls_consumer_expenditures.transportation_share > 0.1 && b.bls_consumer_expenditures.transportation_share < 0.25);
  const cheap = cheapestNewEv(cat);
  assert.ok(cheap.msrp_usd + (cheap.destination_usd ?? 1500) > b.cheapest_ev_abroad.price_usd_approx * 2, "the cheapest EV here costs at least twice the Chinese one");
  const tenK = tenThousandDollarCar(cheap);
  assert.equal(tenK.msrp_usd + (tenK.destination_usd ?? 1500), 10000, "the what-if car lists for exactly $10,000");
  assert.equal(tenK.efficiency_kwh_per_100mi, cheap.efficiency_kwh_per_100mi);
  assert.ok(b.import_barriers.length >= 2);
  const cases = whatIfCases(cat);
  assert.deepEqual(cases.map((c) => c.key), ["keep", "gas", "ev", "tenk"]);
  const by = Object.fromEntries(cases.map((c) => [c.key, c]));
  assert.ok(by.tenk.totalPerMonth < by.ev.totalPerMonth, "a $10,000 car costs less per month than the cheapest real EV");
  assert.ok(by.tenk.lostValuePerMonth < by.ev.lostValuePerMonth, "…because it loses far less value");
  assert.ok(by.tenk.runningPerMonth <= by.ev.runningPerMonth + 1, "same efficiency, cheaper insurance: running costs are no higher");
  assert.equal(by.keep.payment, 0, "keeping the paid-off car has no payment");
  assert.ok(by.ev.payment > 0 && by.gas.payment > 0, "the new cars are financed");
  assert.ok(by.tenk.payment === 0 && by.tenk.cashBack > 0, "the trade-in more than covers a $10,000 car");
  for (const c of cases) assert.ok(close(c.totalPerMonth, c.runningPerMonth + c.lostValuePerMonth, 0.01), `${c.key} total = running + lost value`);
});
