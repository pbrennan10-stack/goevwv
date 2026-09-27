import type { Metadata } from "next";
import { HouseholdPlanner } from "@/components/HouseholdPlanner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  getFederalData,
  getIceVehicles,
  getOwnershipAssumptions,
  getUtilities,
  getVehicles,
} from "@/lib/data";
import type { Catalog } from "@/lib/household";

export const metadata: Metadata = {
  title: "Plan your household: EV + your other vehicles",
  description:
    "Most West Virginia households have two vehicles. Plan them together: who commutes, road trips, towing, luggage, and the full cost of buying an EV — purchase price, WV sales tax, resale, and running costs.",
  alternates: { canonical: "/plan" },
};

export default function PlanPage() {
  // Long free-text fields aren't used by the planner; drop them to keep the
  // page light on phones.
  const catalog: Catalog = {
    evs: getVehicles().map((v) => ({ ...v, notes: "", capability_note: undefined, capability_source: undefined })),
    ice: getIceVehicles().map((v) => ({ ...v, capability_note: undefined, capability_source: undefined })),
    utilities: getUtilities(),
    fed: getFederalData(),
    own: getOwnershipAssumptions(),
  };

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
      <SiteHeader active="/plan" className="mb-8" />
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight">
        Plan your household, <span className="text-brand">not just one car</span>
      </h1>
      <p className="mt-3 mb-6 text-base text-ink-muted">
        Most families keep two vehicles, and an EV often makes the most sense as
        one of them. Tell us who drives where and what trips you take — we&apos;ll
        show what an EV would cost your household, purchase price included, and
        which vehicle should do which job.
      </p>
      <HouseholdPlanner catalog={catalog} />
      <SiteFooter />
    </main>
  );
}
