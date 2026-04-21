import type { Metadata } from "next";
import Link from "next/link";
import { ChargerMap } from "@/components/ChargerMap";
import { Logo } from "@/components/Logo";
import { getChargers } from "@/lib/chargers";

export const metadata: Metadata = {
  title: "WV Charger Map",
  description:
    "Interactive map of West Virginia public EV charging stations — DCFC and L2 — filtered by connector type. Sourced from OpenChargeMap.",
};

// Refresh charger data at most once per day when built in production.
// Locally a fresh fetch happens on every build.
export const revalidate = 86400;

type SearchParams = Record<string, string | string[] | undefined>;

function str(p: SearchParams, k: string): string | null {
  const v = p[k];
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function parseCoords(raw: string | null): [number, number] | null {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 2 || !parts.every(Number.isFinite)) return null;
  return [parts[0], parts[1]];
}

export default async function ChargersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { chargers, retrieved_at, error } = await getChargers();
  const dcfcCount = chargers.filter((c) => c.is_dcfc).length;
  const l2Count = chargers.length - dcfcCount;

  // Optional URL state:
  //   o / d — "lng,lat" origin + destination (shown as a drawn route)
  //   br    — buffer radius in miles (5..25, default 10)
  //   return — encoded URL to send the user back to (e.g. their calc state)
  const origin = parseCoords(str(searchParams, "o"));
  const destination = parseCoords(str(searchParams, "d"));
  const brRaw = str(searchParams, "br");
  const br = brRaw ? Number(brRaw) : NaN;
  const bufferMi = Number.isFinite(br) && br >= 1 && br <= 25 ? br : 10;
  // Only accept absolute-path returns (starts with "/"). Anything else is
  // refused to prevent an open-redirect via a malicious URL.
  const rawReturn = str(searchParams, "return");
  const returnUrl = rawReturn && rawReturn.startsWith("/") ? rawReturn : null;

  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-8 sm:py-12">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link href="/">
            <Logo className="text-2xl" />
          </Link>
          <nav className="text-sm text-ink-soft flex items-center flex-wrap">
            <Link href="/" className="hover:text-ink transition px-2 py-2">
              Home
            </Link>
            <span className="text-slate-300">·</span>
            <Link href="/calculator" className="hover:text-ink transition px-2 py-2">
              Calculator
            </Link>
            <span className="text-slate-300">·</span>
            <Link
              href="/chargers"
              className="text-brand font-semibold transition px-2 py-2"
            >
              Charger Map
            </Link>
            <span className="text-slate-300">·</span>
            <Link href="/about" className="hover:text-ink transition px-2 py-2">
              Why EVs Matter
            </Link>
            <span className="text-slate-300">·</span>
            <Link
              href="/state-of-the-data"
              className="hover:text-ink transition px-2 py-2"
            >
              State of the Data
            </Link>
          </nav>
        </div>
      </header>

      <section className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink leading-tight">
          WV <span className="text-brand">Charger Map</span>
        </h1>
        <p className="mt-2 text-sm sm:text-base text-ink-muted max-w-prose">
          A public inventory of West Virginia EV charging stations (and a buffer around the
          border). Data comes from{" "}
          <a
            href="https://openchargemap.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            OpenChargeMap
          </a>
          , a community-maintained registry. Filter by speed or connector type;
          click a pin for station details and connector counts.{" "}
          <strong>Not exhaustive —</strong>{" "}
          <a
            href="https://www.plugshare.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            PlugShare
          </a>{" "}
          and similar crowd-sourced tools may include chargers this map doesn&rsquo;t
          (newly commissioned stations, residential hosts, private fleet chargers
          opened to the public). For anything trip-critical, cross-check before you go.
        </p>
        {!error && chargers.length > 0 && (
          <p className="mt-2 text-xs text-ink-soft">
            <strong className="text-ink">{chargers.length}</strong> stations loaded
            ({dcfcCount} DCFC · {l2Count} L2) · Data retrieved {retrieved_at}
          </p>
        )}
      </section>

      {/* Honest disclaimer: point users at the tools that actually handle the
          operational/trip-planning questions better than we can. */}
      <section className="mb-6 rounded-xl bg-surface-raised ring-1 ring-slate-200 p-4 sm:p-5 text-sm text-ink-muted leading-relaxed">
        <p className="font-semibold text-ink mb-2">
          There are better tools than this map.
        </p>
        <p className="mb-3">
          This page shows you what exists in WV, but for the questions where
          accuracy matters — <em>is this charger working right now?</em> or{" "}
          <em>can my car actually make the drive?</em> — reach for the right
          tool:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <a
              href="https://www.plugshare.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline font-semibold"
            >
              PlugShare
            </a>{" "}
            — real-time availability, user check-ins, photos, reviews. The
            community-maintained standard for &ldquo;is this charger actually
            working?&rdquo;
          </li>
          <li>
            <a
              href="https://abetterrouteplanner.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline font-semibold"
            >
              A Better Route Planner (ABRP)
            </a>{" "}
            — trip planning with battery simulation, weather, elevation, and
            charging-stop optimization. The gold standard for &ldquo;can I
            actually make this drive?&rdquo;
          </li>
          <li>
            <a
              href="https://chargehub.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline font-semibold"
            >
              ChargeHub
            </a>{" "}
            — North American alternative to PlugShare with strong Canadian
            coverage for border trips.
          </li>
          <li>
            <strong>Your car&rsquo;s built-in navigation</strong> (Tesla,
            Ford, GM, Hyundai/Kia) and the{" "}
            <strong>charging network&rsquo;s own app</strong> (Tesla,
            Electrify America, EVgo, ChargePoint, Blink) show authoritative
            real-time status for their own stations — usually the fastest way
            to verify a specific charger before you pull up.
          </li>
        </ul>
        <p className="mt-3 text-ink-soft">
          This map is a starting point for getting oriented to what&rsquo;s in
          WV. Use those for anything operational.
        </p>
      </section>

      {error ? (
        <div className="rounded-xl bg-amber-50 ring-1 ring-amber-200 p-5 mb-6">
          <p className="text-sm font-semibold text-amber-900 mb-1">
            Charger data temporarily unavailable
          </p>
          <p className="text-sm text-amber-800">
            We couldn&rsquo;t fetch from OpenChargeMap on the last build
            ({error}). Please check back shortly, or browse directly at{" "}
            <a
              href="https://openchargemap.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-amber-950"
            >
              openchargemap.org
            </a>
            .
          </p>
        </div>
      ) : (
        <ChargerMap
          chargers={chargers}
          mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""}
          initialOrigin={origin}
          initialDestination={destination}
          initialBufferMi={bufferMi}
          returnUrl={returnUrl}
        />
      )}

      <section className="mt-8 rounded-xl bg-surface-raised ring-1 ring-slate-200 p-5 text-sm text-ink-muted leading-relaxed space-y-3">
        <h2 className="text-base font-semibold text-ink">Reading this map</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>DCFC stations</strong> (green pins) can add hundreds of miles
            in 20–40 minutes — they&rsquo;re what you use on road trips. WV&rsquo;s
            DCFC network is thin outside I-64, I-77, and I-79 corridors.
          </li>
          <li>
            <strong>L2 stations</strong> (gray pins) add ~20 miles of range per
            hour — fine for destination charging (hotel overnight, workplace for
            8 hours) but not practical as a fuel stop mid-trip.
          </li>
          <li>
            <strong>Connector types:</strong> most new EVs use CCS or NACS; older
            Nissan Leafs use CHAdeMO; J1772 is the universal L2 standard (adapters
            are widely available).
          </li>
          <li>
            Real-time availability and user reviews aren&rsquo;t in our
            data — see the tools called out above (PlugShare, ABRP,
            network apps) before routing to any specific station.
          </li>
        </ul>
      </section>

      <footer className="mt-16 pb-8 border-t border-slate-200 pt-6 text-sm text-ink-soft">
        <p>
          Station data:{" "}
          <a
            href="https://openchargemap.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-ink"
          >
            OpenChargeMap
          </a>{" "}
          (community-maintained, free). Refreshed on each deploy. For the full
          data provenance trail, see the{" "}
          <Link href="/state-of-the-data" className="text-brand hover:underline">
            State of the Data
          </Link>{" "}
          page.
        </p>
      </footer>
    </main>
  );
}
