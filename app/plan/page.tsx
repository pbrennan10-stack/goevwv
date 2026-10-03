import type { Metadata } from "next";
import { HouseholdPlanner } from "@/components/HouseholdPlanner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { planCatalog } from "@/lib/planCatalog";
import { shareText, shareTitle, verdictFromLink } from "@/lib/planVerdict";

const BASE_METADATA: Metadata = {
  title: "Plan your household: EV + your other vehicles",
  description:
    "Most West Virginia households have two vehicles. Plan them together: who commutes, road trips, towing, luggage, and the full cost of buying an EV — purchase price, WV sales tax, resale, and running costs.",
  alternates: { canonical: "/plan" },
};

type SearchParams = Record<string, string | string[] | undefined>;

// A shared plan (/plan?h=…) gets its own title, description and preview image
// — the verdict — so the link shows the answer wherever it's pasted. The
// canonical stays /plan: to search engines, shared links are one page. Reading
// the query here makes /plan render per request rather than at build.
export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const sp = await searchParams;
  const h = typeof sp.h === "string" ? sp.h : undefined;
  const v = h ? verdictFromLink(h, planCatalog()) : null;
  if (!h || !v) return BASE_METADATA;
  const title = shareTitle(v);
  const description = `${shareText(v)} Made with the GoEV WV household planner — try yours.`;
  const q = encodeURIComponent(h);
  const image = { url: `/plan/share-image?h=${q}`, width: 1200, height: 630, alt: title };
  return {
    ...BASE_METADATA,
    title,
    description,
    openGraph: { title, description, url: `/plan?h=${q}`, siteName: "GoEV WV", type: "website", locale: "en_US", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default function PlanPage() {
  const catalog = planCatalog();

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
