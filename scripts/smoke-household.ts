// Sanity run of the household engine against real data.
// Run: npx tsc scripts/smoke-household.ts --outDir <tmp> --module commonjs --target es2020 --esModuleInterop --skipLibCheck && node <tmp>/scripts/smoke-household.js
import { getFederalData, getIceVehicles, getOwnershipAssumptions, getUtilities, getVehicles } from "../lib/data";
import { fit, planHousehold, type HouseholdInput, type ScenarioResult } from "../lib/household";

const cat = { evs: getVehicles(), ice: getIceVehicles(), utilities: getUtilities(), fed: getFederalData(), own: getOwnershipAssumptions() };
const h: HouseholdInput = {
  owned: [
    { key: "a", ref: "ice:honda-crv-2024", valueNow: 18000 },
    { key: "b", ref: "ice:chevy-silverado-2024", valueNow: 30000 },
  ],
  candidate: { ref: "ev:tesla-model-y-2025", price: 49990 + 1390, replaces: "a" },
  gasAlternative: { ref: "ice:honda-crv-2024", price: 33020 + 1450 },
  drivers: [{ id: 1, commuteOneWayMi: 21, daysPerWeek: 5 }, { id: 2, commuteOneWayMi: 0, daysPerWeek: 0 }],
  errandsMiPerWeek: 60, errandsPeople: 3,
  trips: [
    { id: "beach", label: "Beach vacation", oneWayMi: 400, perYear: 1, people: 4, luggageCuFt: 28, towLbs: 0 },
    { id: "camper", label: "Tow the camper", oneWayMi: 60, perYear: 3, people: 4, luggageCuFt: 8, towLbs: 5000 },
  ],
  utilityId: "aep", useTOU: false, gasPrice: 3.45, years: 5, overrides: {}, retention5yOverride: null,
};
const r = planHousehold(h, cat);
const $ = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const show = (label: string, s: ScenarioResult) => {
  console.log(`\n== ${label}: ${$(s.totalOverPeriod)} over ${h.years} yr (${$(s.perYear)}/yr; running ${$(s.runningPerYear)}/yr; capital ${$(s.capitalOverPeriod)}; upfront ${$(s.upfrontCash)})`);
  for (const u of s.units) console.log(`  ${u.unit.name}: ${Math.round(u.miles)} mi, energy ${$(u.energy)}, maint ${$(u.maintenance)}, ins ${$(u.insurance)}, reg ${$(u.registration)} | ${u.capitalNote} | ${u.uses.map((x) => x.label).join(", ")}`);
  if (s.unassigned.length) console.log("  UNASSIGNED:", s.unassigned.map((x) => x.label));
};
show("Today", r.today);
if (r.plan) show("With Model Y replacing CR-V", r.plan);
if (r.gasAlt) show("With a new CR-V instead", r.gasAlt);
for (const use of r.uses.filter((u) => u.kind === "trip")) for (const u of r.planUnits) { const f = fit(u, use); console.log(`  fit ${use.label} / ${u.short}: ${f.level} — ${f.text}`); }

// Resale range, charging plan, tipping points
import { tippingPoints, usedBreakEvenPrice } from "../lib/household";
console.log("\nrange low/high:", JSON.stringify(r.range));
console.log("charging:", JSON.stringify(r.plan?.charging));
console.log("tipping:", JSON.stringify(tippingPoints(h, cat)));
if (r.plan && r.gasAlt) console.log("used break-even vs new gas:", Math.round(usedBreakEvenPrice(r.plan, r.gasAlt.totalOverPeriod, h, cat) ?? -1), "vs today:", Math.round(usedBreakEvenPrice(r.plan, r.today.totalOverPeriod, h, cat) ?? -1));
