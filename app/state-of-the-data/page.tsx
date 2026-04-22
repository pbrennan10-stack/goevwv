import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getFederalData, getUtilities } from "@/lib/data";

export const metadata: Metadata = {
  title: "State of the Data",
  description:
    "Every number on GoEV WV — utility rates, tax credits, state fees, and assumptions — with sources, retrieval dates, and confidence levels. A transparent audit trail of where our calculator's inputs come from.",
};

const LAST_REVIEWED = "April 18, 2026";

type Confidence = "verified" | "approximate" | "pending";

function ConfidenceTag({ level }: { level: Confidence }) {
  const styles: Record<Confidence, string> = {
    verified: "bg-brand-bg text-brand-dark border-brand/30",
    approximate: "bg-amber-50 text-amber-800 border-amber-300",
    pending: "bg-slate-100 text-slate-700 border-slate-300",
  };
  const label: Record<Confidence, string> = {
    verified: "Verified",
    approximate: "Approximate",
    pending: "Pending",
  };
  return (
    <span
      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded border ${styles[level]} whitespace-nowrap`}
    >
      {label[level]}
    </span>
  );
}

function SourceRow({
  label,
  value,
  source,
  sourceUrl,
  retrieved,
  confidence,
  notes,
}: {
  label: string;
  value: string;
  source: string;
  sourceUrl?: string;
  retrieved: string;
  confidence: Confidence;
  notes?: string;
}) {
  return (
    <div className="border-t border-slate-200 py-4 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-ink-soft">{label}</div>
          <div className="text-lg font-semibold text-ink mt-0.5">{value}</div>
        </div>
        <ConfidenceTag level={confidence} />
      </div>
      <div className="mt-2 text-sm text-ink-muted space-y-1">
        <div>
          <span className="text-ink-soft">Source: </span>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline break-words"
            >
              {source}
            </a>
          ) : (
            <span>{source}</span>
          )}
        </div>
        <div>
          <span className="text-ink-soft">Retrieved: </span>
          <span>{retrieved}</span>
        </div>
        {notes ? (
          <div className="text-ink-soft leading-relaxed pt-1">{notes}</div>
        ) : null}
      </div>
    </div>
  );
}

function Section({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="border border-slate-200 rounded-lg bg-surface overflow-hidden group"
    >
      <summary className="cursor-pointer list-none px-5 py-4 hover:bg-surface-raised transition flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <p className="text-sm text-ink-soft mt-0.5">{summary}</p>
        </div>
        <span
          aria-hidden="true"
          className="text-ink-soft text-lg leading-none mt-1 group-open:rotate-45 transition-transform"
        >
          +
        </span>
      </summary>
      <div className="px-5 pb-5 pt-2 border-t border-slate-200">{children}</div>
    </details>
  );
}

export default function StateOfTheDataPage() {
  const federal = getFederalData();
  const utilities = getUtilities();

  const aep = utilities.find((u) => u.id === "aep");
  const monPower = utilities.find((u) => u.id === "mon_power");
  const wheeling = utilities.find((u) => u.id === "wheeling_power");
  const coops = utilities.find((u) => u.id === "rural_coops");

  return (
    <main className="mx-auto max-w-content px-4 sm:px-6 py-8 sm:py-12">
      <header className="mb-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link href="/">
            <Logo className="text-2xl" />
          </Link>
          <nav className="text-sm text-ink-soft flex items-center">
            <Link href="/" className="hover:text-ink transition px-2 py-2">
              Home
            </Link>
            <span className="text-slate-300">·</span>
            <Link
              href="/calculator"
              className="hover:text-ink transition px-2 py-2"
            >
              Calculator
            </Link>
            <span className="text-slate-300">·</span>
            <Link href="/chargers" className="hover:text-ink transition px-2 py-2">
              Charger Map
            </Link>
            <span className="text-slate-300">·</span>
            <Link
              href="/about"
              className="hover:text-ink transition px-2 py-2"
            >
              Why EVs Matter
            </Link>
            <span className="text-slate-300">·</span>
            <Link
              href="/state-of-the-data"
              className="text-brand font-semibold transition px-2 py-2"
            >
              State of the Data
            </Link>
          </nav>
        </div>
      </header>

      <article className="max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink leading-tight mb-3">
          State of the <span className="text-brand">Data</span>
        </h1>
        <p className="text-ink-muted text-base sm:text-lg leading-relaxed mb-2">
          Every rate, fee, credit, and assumption that feeds the calculator —
          with the source, the date it was pulled, and how confident we are
          in it.
        </p>
        <p className="text-ink-soft text-sm mb-8">
          Last reviewed: {LAST_REVIEWED}. Rates and programs change; refresh
          quarterly or when major legislation passes.
        </p>

        <div className="bg-surface-raised border border-slate-200 rounded-lg p-5 mb-10">
          <h2 className="text-sm font-bold text-ink uppercase tracking-wide mb-2">
            How to read this page
          </h2>
          <ul className="text-sm text-ink-muted space-y-1.5 leading-relaxed">
            <li>
              <ConfidenceTag level="verified" />{" "}
              <span className="ml-1">
                — pulled from an official or authoritative source on the
                retrieval date.
              </span>
            </li>
            <li>
              <ConfidenceTag level="approximate" />{" "}
              <span className="ml-1">
                — our best estimate; authoritative source exists but was not
                directly retrieved, or values vary across the population we're
                summarizing.
              </span>
            </li>
            <li>
              <ConfidenceTag level="pending" />{" "}
              <span className="ml-1">
                — we've flagged this for verification and it should be
                double-checked before relying on it.
              </span>
            </li>
          </ul>
        </div>

        <div className="space-y-4">

          <Section
            title="Federal tax credits"
            summary="IRS clean vehicle and refueling property credits under the 2022 IRA as modified by the 2025 OBBB."
            defaultOpen
          >
            <SourceRow
              label="IRC §30D — New clean vehicle credit (up to $7,500)"
              value="TERMINATED for vehicles acquired after 2025-09-30"
              source="IRS FAQ on P.L. 119-21 (OBBB)"
              sourceUrl="https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb"
              retrieved="2026-04-18"
              confidence="verified"
              notes="The One Big Beautiful Bill Act (enacted July 4, 2025) terminated the §30D credit. A taxpayer with a written binding contract and payment made on or before September 30, 2025 can still claim the credit even if the vehicle is placed in service later. The calculator treats the credit as unavailable for new purchases."
            />
            <SourceRow
              label="IRC §25E — Used clean vehicle credit (30% / $4,000 max)"
              value="TERMINATED for vehicles acquired after 2025-09-30"
              source="IRS FAQ on P.L. 119-21 (OBBB)"
              sourceUrl="https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb"
              retrieved="2026-04-18"
              confidence="verified"
              notes="Same termination date as §30D under OBBB. No longer available for post-deadline purchases."
            />
            <SourceRow
              label="IRC §30C — Home EV charger credit (30% / $1,000 max)"
              value="Terminates 2026-06-30 — applies to home installs"
              source="IRS FAQ on P.L. 119-21 (OBBB)"
              sourceUrl="https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb"
              retrieved="2026-04-18"
              confidence="verified"
              notes="Not allowed for any property placed in service after June 30, 2026 — this termination applies to BOTH residential and commercial installations. Home installs must be completed and placed in service before that date, and the home must be in an eligible census tract (low-income or non-urban)."
            />
            <SourceRow
              label="IRC §30C — Commercial EV charger credit (30% up to $100k/port)"
              value="Terminates 2026-06-30 — same window as residential"
              source="IRS FAQ on P.L. 119-21 (OBBB)"
              sourceUrl="https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb"
              retrieved="2026-04-18"
              confidence="verified"
              notes="Relevant to v2 business-mode and fleet users. The June 30, 2026 cliff is the binding date; projects need to be placed in service by then, not merely contracted."
            />
          </Section>

          <Section
            title="West Virginia state fees"
            summary="Registration base fee plus EV/PHEV surcharges under WV Code §17A-10-3c."
          >
            <div className="bg-brand-bg border border-brand/30 rounded p-4 mb-4 text-sm text-ink-muted leading-relaxed">
              <p className="font-semibold text-ink mb-1">How the WV registration fees stack up</p>
              <p className="mb-2">
                Every passenger vehicle in WV pays the <strong>$51.50 Class A base registration</strong>.
                EVs and PHEVs pay an <em>additional</em> surcharge on top of that.
              </p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Gasoline car: $51.50 total</li>
                <li>Plug-in hybrid: $51.50 + $100 = <strong>$151.50 total</strong></li>
                <li>Battery-electric: $51.50 + $200 = <strong>$251.50 total</strong></li>
              </ul>
              <p className="mt-2">
                The $250-ish figure that shows up in casual sources is the{" "}
                <em>total</em> annual registration for a BEV; the $200 in the
                statute is the <em>EV-specific surcharge</em> on top of the
                base fee. Our calculator adds $200 (not $250) to EV annual cost
                because the gasoline-vehicle comparison already excludes the
                $51.50 base — we're comparing the incremental cost of going
                electric, not the total DMV bill.
              </p>
            </div>
            <SourceRow
              label="BEV annual surcharge (added to TCO)"
              value={`$${federal.wv_state_fees.bev_annual_fee.amount_usd}/year`}
              source="WV Code §17A-10-3c (confirmed by AFDC)"
              sourceUrl="https://code.wvlegislature.gov/17A-10-3c/"
              retrieved="2026-04-18"
              confidence="verified"
              notes="The statute specifies $200 for battery-electric vehicles operating exclusively on electricity. At 10,000 miles/year this works out to 2.0¢/mile in state road tax, vs. ~1.4¢/mile that a 25-mpg gasoline vehicle pays at the current WV fuel tax rate."
            />
            <SourceRow
              label="PHEV annual surcharge (added to TCO)"
              value={`$${federal.wv_state_fees.phev_annual_fee.amount_usd}/year`}
              source="WV Code §17A-10-3c (confirmed by AFDC)"
              sourceUrl="https://code.wvlegislature.gov/17A-10-3c/"
              retrieved="2026-04-18"
              confidence="verified"
              notes="Applies to vehicles operating on a combination of electricity and petrochemical fuels. Statute enacted via Enrolled SB 1006 (2017 First Special Session)."
            />
            <SourceRow
              label="Standard Class A base registration (paid by all vehicles)"
              value={
                federal.wv_state_fees.standard_registration_fee
                  ? `$${federal.wv_state_fees.standard_registration_fee.amount_usd.toFixed(2)}/year`
                  : "$51.50/year"
              }
              source="WV DMV fee schedule"
              sourceUrl="https://feecalculator.us/west-virginia-vehicle-registration-fee-calculator/"
              retrieved="2026-04-18"
              confidence="verified"
              notes="Includes $1.00 litter fee and $0.50 insurance fee. A 2-year registration option exists at $103.00. Paid by every Class A passenger vehicle regardless of powertrain — which is why the calculator doesn't add it to either side of the EV-vs-gas comparison."
            />
            <SourceRow
              label="WV state EV purchase incentives"
              value="None"
              source="AFDC West Virginia laws registry"
              sourceUrl="https://afdc.energy.gov/laws/all?state=WV"
              retrieved="2026-04-18"
              confidence="verified"
              notes="West Virginia does not offer state-level tax credits, rebates, or purchase incentives for new or used EVs. The only WV-level financial levers are utility rebates (see below), the $200/$100 EV/PHEV annual fee, and any local municipal programs not tracked here."
            />
          </Section>

          <Section
            title="Appalachian Power (AEP) — residential rates"
            summary="Southern and central West Virginia. Rates effective December 12, 2025."
          >
            {aep ? (
              <>
                <SourceRow
                  label="Marginal energy rate (used for EV charging cost)"
                  value={`$${aep.residential.flat_rate_per_kwh.toFixed(3)}/kWh`}
                  source="AEP WV rates page and bill examples"
                  sourceUrl="https://www.appalachianpower.com/company/about/rates/wv"
                  retrieved="2026-04-18"
                  confidence="verified"
                  notes="Derived from AEP's own bill examples: 1,000 kWh = $176.43 and 2,000 kWh = $332.13. Subtracting implies ~$20.73/month in fixed charges and a marginal variable rate of ~$0.156/kWh. EV charging is an incremental load, so the marginal rate — not the all-in average — is the right number. Using the all-in average ($0.176/kWh) would overstate EV charging costs by ~13%."
                />
                <SourceRow
                  label="Monthly customer charge (fixed)"
                  value={`$${aep.residential.monthly_customer_charge.toFixed(2)}/month`}
                  source="AEP WV rates page"
                  sourceUrl="https://www.appalachianpower.com/company/about/rates/wv"
                  retrieved="2026-04-18"
                  confidence="verified"
                  notes="Includes base customer charge plus all riders (effective December 12, 2025). This is what a customer pays before any kWh consumption."
                />
                <SourceRow
                  label="AEP WV Off-Peak EV Charging — off-peak rate"
                  value="$0.129/kWh"
                  source="AEP Off-Peak EV Charging program page"
                  sourceUrl="https://www.appalachianpower.com/clean-energy/electric-cars/wv-off-peak"
                  retrieved="2026-04-18"
                  confidence="verified"
                  notes="Off-peak hours: 8pm–6am Mon–Fri, all day Sat/Sun/federal holidays. Program requires a separate EV meter installed by a licensed electrician; AEP provides the meter hardware at no charge. Primary house meter must be AMI-enabled. No enrollment fee."
                />
                <SourceRow
                  label="AEP WV Off-Peak EV Charging — on-peak rate"
                  value="$0.227/kWh"
                  source="AEP Off-Peak EV Charging program page"
                  sourceUrl="https://www.appalachianpower.com/clean-energy/electric-cars/wv-off-peak"
                  retrieved="2026-04-18"
                  confidence="verified"
                  notes="Standard residential rate (~$0.176/kWh) plus a $0.051/kWh on-peak surcharge. The calculator assumes users on the TOU program charge 100% off-peak (committed overnight charging); in practice any daytime charging hits this higher rate."
                />
              </>
            ) : null}
          </Section>

          <Section
            title="Mon Power (FirstEnergy) — residential rates"
            summary="Northern and north-central West Virginia. Serves ~395,000 accounts across 34 counties."
          >
            {monPower ? (
              <>
                <SourceRow
                  label="Residential flat rate"
                  value={`$${monPower.residential.flat_rate_per_kwh.toFixed(3)}/kWh`}
                  source="utility-rates.com tariff snapshot (March 2026)"
                  sourceUrl="https://utility-rates.com/providers/mon-power"
                  retrieved="2026-04-18"
                  confidence="verified"
                  notes="March 2026 average was 13.8¢/kWh. Energy charge varies 12.97–13.77¢/kWh across service zones. Authoritative source is the WVMPRetailTariff PDF filed with the WV PSC — refresh against that quarterly. Recent rate cases have approved double-digit increases; trend is upward."
                />
                <SourceRow
                  label="Monthly customer charge"
                  value={`$${monPower.residential.monthly_customer_charge.toFixed(2)}/month`}
                  source="FirstEnergy WV tariff (2023-09 filing)"
                  sourceUrl="https://www.firstenergycorp.com/content/dam/customer/Customer%20Choice/Files/west-virginia/tariffs/WVMPRetailTariff.pdf"
                  retrieved="2026-04-18"
                  confidence="verified"
                  notes="Monthly customer charge confirmed at $8.00 per utility-rates.com snapshot."
                />
                <SourceRow
                  label="EV time-of-use (TOU) rate"
                  value="Not offered in West Virginia"
                  source="FirstEnergy WV EV page and AFDC registry"
                  sourceUrl="https://www.firstenergycorp.com/help/saving_energy/electric-vehicles/wv-ev.html"
                  retrieved="2026-04-18"
                  confidence="verified"
                  notes="FirstEnergy's WV EV page directs customers to an external ChooseEV resource but lists no residential EV TOU rate. AFDC's WV registry lists zero FirstEnergy WV EV incentives or programs. TOU pilots exist in other FirstEnergy states (PA, NJ) but not WV."
                />
                <SourceRow
                  label="EV charger rebates"
                  value="None offered"
                  source="AFDC West Virginia laws registry"
                  sourceUrl="https://afdc.energy.gov/laws/all?state=WV"
                  retrieved="2026-04-18"
                  confidence="verified"
                  notes="Mon Power / FirstEnergy does not currently offer a WV residential EV charger rebate. Previous data included a placeholder entry awaiting verification — that has been removed after direct confirmation."
                />
              </>
            ) : null}
          </Section>

          <Section
            title="Wheeling Power — residential rates"
            summary="AEP subsidiary serving the northern panhandle (Wheeling–Weirton corridor). Approximate — needs tariff verification."
          >
            {wheeling ? (
              <>
                <SourceRow
                  label="Residential flat rate"
                  value={`~$${wheeling.residential.flat_rate_per_kwh.toFixed(3)}/kWh`}
                  source="Approximate (parity with AEP WV tariff structure)"
                  sourceUrl="https://www.psc.state.wv.us"
                  retrieved="2026-04-18"
                  confidence="approximate"
                  notes="Wheeling Power serves ~40,000 customers and files separate tariffs from AEP at the WV PSC. We could not retrieve the utility's own rate page on the verification date. findenergy.com reports Ohio County average at ~17.56¢/kWh. Values here are an estimate; panhandle users should verify against their actual bill."
                />
                <SourceRow
                  label="Monthly customer charge"
                  value={`~$${wheeling.residential.monthly_customer_charge.toFixed(2)}/month`}
                  source="Approximate"
                  retrieved="2026-04-18"
                  confidence="approximate"
                  notes="Not independently verified on this refresh cycle. Similar to AEP customer charge structure."
                />
                <SourceRow
                  label="EV programs (rebate + off-peak rate)"
                  value="Same programs as AEP (Charge Forward)"
                  source="TakeChargeWV"
                  sourceUrl="https://takechargewv.com/programs/for-your-home/chargeforward"
                  retrieved="2026-04-18"
                  confidence="verified"
                  notes="Wheeling Power customers participate in the same Charge Forward Level 2 rebate and Off-Peak EV program as AEP, administered through TakeChargeWV."
                />
              </>
            ) : null}
          </Section>

          <Section
            title="Rural electric cooperatives"
            summary="Various rural WV counties. Coop-specific rates are not independently verified."
          >
            <div className="text-sm text-ink-muted leading-relaxed mb-4">
              West Virginia has several rural electric cooperatives serving
              smaller portions of the state. Coop rate schedules generally
              are not published inline on public websites and require direct
              tariff retrieval or a member call. For v1, the calculator shows
              a "contact your coop" card rather than calculating off unverified
              estimates for users whose ZIP resolves to a coop service area.
              Generic fallback rate used only when a coop cannot be identified:
              $0.120/kWh.
            </div>
            {coops ? (
              <SourceRow
                label="Generic coop fallback rate"
                value={`$${coops.residential.flat_rate_per_kwh.toFixed(3)}/kWh`}
                source="WV coop rate approximation"
                retrieved="2026-04-18"
                confidence="approximate"
                notes="Used only as a last-resort estimate. Coops typically charge at-cost and rates vary; the disclaimer in the calculator tells users to contact their specific cooperative."
              />
            ) : null}
            <SourceRow
              label="Harrison Rural Electrification Association"
              value="~$0.115/kWh (estimated)"
              source="harrisonrea.com"
              sourceUrl="https://www.harrisonrea.com"
              retrieved="2026-04-18"
              confidence="approximate"
              notes="Rate not independently retrieved from tariff PDF; members should verify from their bill."
            />
            <SourceRow
              label="Black Diamond Power"
              value="~$0.120/kWh (estimated)"
              source="blackdiamondpower.com"
              sourceUrl="https://www.blackdiamondpower.com"
              retrieved="2026-04-18"
              confidence="approximate"
              notes="Estimate only; not independently retrieved from current tariff."
            />
            <SourceRow
              label="Craig-Botetourt Electric Cooperative"
              value="~$0.140/kWh (estimated)"
              source="cbec.coop"
              sourceUrl="https://www.cbec.coop"
              retrieved="2026-04-18"
              confidence="approximate"
              notes="Serves a small portion of WV. Estimate only; not independently retrieved from current tariff."
            />
          </Section>

          <Section
            title="Utility rebates and EV programs"
            summary="What's currently available for WV EV owners through their utility."
          >
            <SourceRow
              label="AEP Charge Forward Level 2 charger rebate"
              value="Up to $250"
              source="TakeChargeWV (confirmed active in AFDC WV registry)"
              sourceUrl="https://takechargewv.com/programs/for-your-home/chargeforward"
              retrieved="2026-04-18"
              confidence="verified"
              notes="Rebate for purchase and installation of an ENERGY STAR certified Level 2 EV charger. Must be an AEP (or Wheeling Power) residential customer. No stated end date as of retrieval; AFDC lists the program as ongoing."
            />
            <SourceRow
              label="AEP Charge Forward Licensed Electrician bonus"
              value="Additional $250"
              source="TakeChargeWV"
              sourceUrl="https://takechargewv.com/programs/for-your-home/chargeforward"
              retrieved="2026-04-18"
              confidence="verified"
              notes="Bundled with the L2 rebate above. Requires installation by a licensed electrician. Stackable with the federal §30C home charger credit."
            />
            <SourceRow
              label="Mon Power / FirstEnergy WV EV programs"
              value="None"
              source="FirstEnergy WV EV page and AFDC registry"
              sourceUrl="https://www.firstenergycorp.com/help/saving_energy/electric-vehicles/wv-ev.html"
              retrieved="2026-04-18"
              confidence="verified"
              notes="Neither a charger rebate nor an EV TOU rate is offered in West Virginia as of the retrieval date."
            />
            <SourceRow
              label="WV school bus electrification reimbursement"
              value="10–15% reimbursement"
              source="AFDC West Virginia laws registry"
              sourceUrl="https://afdc.energy.gov/laws/all?state=WV"
              retrieved="2026-04-18"
              confidence="verified"
              notes="10% reimbursement for county school districts using electric (or CNG/propane) buses, plus an additional 5% for in-state manufacturing. Not applicable to individual consumers but included here for completeness."
            />
          </Section>

          <Section
            title="Gas price baseline"
            summary="Used to compare EV charging costs against what a gasoline vehicle would pay."
          >
            <SourceRow
              label="WV statewide average (regular unleaded)"
              value={`$${federal.calculation_notes.gas_price_baseline_per_gal.current.toFixed(2)}/gal`}
              source="AAA Fuel Prices — West Virginia"
              sourceUrl="https://gasprices.aaa.com/?state=WV"
              retrieved="2026-04-18"
              confidence="verified"
              notes="Pump prices vary meaningfully across the state — at this snapshot, Parkersburg was ~22¢/gal below the northern WV average ($3.69 vs. $3.91). Users can override this value in the calculator. Refresh quarterly; gas prices are volatile."
            />
            <SourceRow
              label="WV alternative fuels tax"
              value="$0.205 / gasoline gallon equivalent"
              source="AFDC West Virginia laws registry"
              sourceUrl="https://afdc.energy.gov/laws/all?state=WV"
              retrieved="2026-04-18"
              confidence="verified"
              notes="Applied to alternative fuels (CNG, propane, etc.) at the pump. Not directly applicable to residential EV charging at home, but relevant context for understanding how WV taxes non-gasoline fuels."
            />
          </Section>

          <Section
            title="DC fast charging (DCFC) assumptions"
            summary="Rate and time math used for long-trip public fast-charging stops."
          >
            <div className="bg-surface-raised border border-slate-200 rounded p-4 mb-4 text-sm text-ink-muted leading-relaxed">
              <p className="font-semibold text-ink mb-1">Why DCFC deserves its own line</p>
              <p>
                Public fast charging typically costs <strong>~3× more per kWh</strong>{" "}
                than charging at home. For a driver who takes 10+ road trips a
                year, quietly pricing every kWh at the home utility rate
                overstates EV savings by hundreds of dollars. The calculator now
                splits BEV energy into home-rate kWh (commute + long-trip
                &ldquo;first tank&rdquo; before departure) and DCFC-rate kWh
                (mid-route charging stops).
              </p>
            </div>
            <SourceRow
              label="DCFC rate (long-trip kWh)"
              value={`$${federal.calculation_notes.dcfc_rate_per_kwh?.current.toFixed(2) ?? "0.48"}/kWh`}
              source="Electrify America Pass (non-member) rate"
              sourceUrl="https://www.electrifyamerica.com/pricing/"
              retrieved="2026-04-18"
              confidence="verified"
              notes="Chosen as a conservative walk-up default matching the dominant public network on WV's I-64 / I-77 / I-79 corridors. Actual network rates in April 2026: Electrify America Pass $0.43–$0.60, Pass+ ~$0.38 ($4/mo); Tesla Supercharger (non-Tesla) $0.35–$0.50, with a subscription dropping ~$0.10/kWh; EVgo walk-up $0.38–$0.52. Members of any network will pay meaningfully less — this is the no-subscription case."
            />
            <SourceRow
              label="kWh delivered per DCFC stop"
              value="70% of battery capacity"
              source="Industry convention (10% → 80% SoC before taper)"
              retrieved="Calculation methodology set 2026-04-18"
              confidence="verified"
              notes="Charging past ~80% slows dramatically as the charge curve tapers to protect the battery. Most road-trip stops end at 80%. We compute DCFC kWh as (stops × battery_kwh × 0.7), clamped to the vehicle's total annual kWh so it never exceeds total consumption."
            />
            <SourceRow
              label="Per-stop time overhead"
              value="+4 minutes beyond raw 10→80% charge time"
              source="Industry-typical (plug-in, authentication, session init, unplug)"
              retrieved="Calculation methodology set 2026-04-18"
              confidence="verified"
              notes="Each stop's displayed time = (vehicle's spec 10→80% charge minutes) + 4 min of fixed overhead. Real-world networks vary 3–8 min for authentication and session handling; 4 min is a conservative mid-point. Over 24 stops/yr that's an extra 1.6 hours that would be invisible without this adjustment."
            />
            <SourceRow
              label="Winter DCFC slowdown"
              value="+8% annualized charge time (when winter toggle is on)"
              source="Battery thermal management research (AAA, Recurrent, manufacturer curves)"
              retrieved="Calculation methodology set 2026-04-18"
              confidence="approximate"
              notes="Cold batteries throttle DCFC power by 20–40% until preconditioned. Averaged across 4 cold WV months, this works out to ~8% longer DCFC time annually. Only applied when the user's Winter derate toggle is on — the same toggle that adds 12% to annual kWh. A cold-climate driver who regularly preconditions the battery via navigation will see less of this penalty."
            />
            <SourceRow
              label="Home-charged &ldquo;first tank&rdquo; of a long trip"
              value="90% of usable highway range, no DCFC cost"
              source="Standard BEV road-trip planning"
              retrieved="Calculation methodology set 2026-04-18"
              confidence="verified"
              notes="The first leg of any long trip starts from home on a full battery — those kWh are charged overnight at the home rate, not at DCFC. Only miles beyond the first tank hit DCFC. Similarly the destination is assumed to have overnight L2 (hotel, family garage, Supercharger near hotel) so return-leg kWh may or may not hit DCFC depending on range."
            />
          </Section>

          <Section
            title="Calculation assumptions"
            summary="Physics and fleet-behavior constants used in the TCO math."
          >
            <SourceRow
              label="Winter range derate (WV)"
              value="+12% annual kWh consumption"
              source="Industry research (AAA, Recurrent, Geotab)"
              retrieved="Calculation methodology set 2026-04-18"
              confidence="verified"
              notes="Derived from ~4 cold WV months experiencing ~28% range loss, averaged into an annual multiplier. Toggleable in the UI; default on. Industry data shows 20–40% cold-weather range loss depending on model and HVAC use; 28% is a conservative mid-range choice."
            />
            <SourceRow
              label="PHEV electric/gas split"
              value="65% electric miles, 35% gas miles"
              source="Argonne National Lab / INL fleet data"
              retrieved="Calculation methodology set 2026-04-18"
              confidence="verified"
              notes="Based on US DOE fleet studies of PHEV utility factor. Real-world split depends heavily on owner charging discipline — some owners get 80%+ electric, others under 40% if they rarely plug in."
            />
            <SourceRow
              label="WV grid CO₂ emissions factor"
              value="0.67 kg CO₂/kWh"
              source="EIA State Electricity Profile — WV"
              sourceUrl="https://www.eia.gov/electricity/state/westvirginia/"
              retrieved="Calculation methodology set 2026-04-18"
              confidence="approximate"
              notes="WV's grid is approximately 90% coal-fired, making per-kWh emissions among the highest in the US. This factor is a blended average and will shift as renewable capacity increases. The calculator compares this against EPA's direct tailpipe factor of 8.887 kg CO₂/gallon of gasoline."
            />
            <SourceRow
              label="Tax credit eligibility thresholds (cached from pre-OBBB rules)"
              value="MSRP ≤ $55k (cars) / $80k (SUVs/trucks); income caps apply"
              source="IRS prior guidance (relevant only for pre-2025-09-30 purchases)"
              sourceUrl="https://www.irs.gov/credits-deductions/credits-for-new-clean-vehicles-purchased-in-2023-or-after"
              retrieved="2026-04-18"
              confidence="verified"
              notes="Retained in the dataset for historical accuracy and for users reviewing past purchases. With §30D now terminated, these caps do not apply to new purchases."
            />
          </Section>

          <Section
            title="Public charger data (/chargers map)"
            summary="How the WV charger map gets its data and how fresh it is."
          >
            <SourceRow
              label="Station locations, connectors, power ratings"
              value="OpenChargeMap community registry"
              source="openchargemap.org API v3 (keyless public endpoint)"
              sourceUrl="https://openchargemap.org"
              retrieved="Refreshed on every site build/deploy"
              confidence="approximate"
              notes="OpenChargeMap is maintained by volunteers and operators submitting updates. Coverage is generally good for major networks (Electrify America, Tesla, EVgo, ChargePoint) and weaker for small municipal or independent stations. Real-time availability and reliability reports are NOT in our data — use PlugShare or the charging network's own app before routing to a station."
            />
            <SourceRow
              label="Bounding box used for WV fetch"
              value="(37.0, -82.9) to (40.9, -77.5)"
              source="GoEV WV curated — covers WV + a small buffer into VA/KY/OH/MD/PA"
              retrieved="Methodology set 2026-04-19"
              confidence="verified"
              notes="The buffer captures border-area stations a WV driver might realistically use — e.g., a charger 5 miles across the Kentucky line on US-23."
            />
            <SourceRow
              label="Connector-type normalization"
              value="CCS · NACS · Tesla (legacy) · CHAdeMO · J1772 · Other"
              source="GoEV WV mapping of OpenChargeMap's ~50 specific connector records"
              retrieved="Methodology set 2026-04-19"
              confidence="verified"
              notes="OpenChargeMap catalogs many specific connector variants (e.g., 'CCS (Type 1)', 'CCS (Type 2)', 'SAE J1772 CCS'); we collapse these into the handful of categories a driver actually cares about. 'Tesla' here means the legacy proprietary port — new vehicles with NACS show under NACS."
            />
          </Section>

          <Section
            title="Vehicle data methodology"
            summary="How we source MSRPs, EPA ranges, and efficiency for the 43 EVs and PHEVs in the picker."
          >
            <div className="text-sm text-ink-muted leading-relaxed space-y-3">
              <p>
                Vehicle specs are curated — not scraped — from the following
                sources as of late 2025 / early 2026:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>MSRPs:</strong> manufacturer websites and automotive
                  press for MY2025 base trims. These are approximations; actual
                  transaction prices vary by region, incentive, and trim level.
                  Refresh quarterly.
                </li>
                <li>
                  <strong>EPA combined range (range_mi):</strong> EPA-certified
                  values from{" "}
                  <a
                    href="https://www.fueleconomy.gov"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline"
                  >
                    fueleconomy.gov
                  </a>
                  .
                </li>
                <li>
                  <strong>Winter range (winter_range_mi):</strong> our derated
                  estimate applying a ~28% haircut to EPA combined range.
                </li>
                <li>
                  <strong>City/highway efficiency:</strong> EPA
                  MPGe-to-kWh/100mi conversions from fueleconomy.gov.
                </li>
                <li>
                  <strong>Tax credit eligibility flags:</strong> historical
                  (pre-OBBB). Retained in the dataset but the §30D credit is
                  terminated for post-2025-09-30 purchases, so these flags no
                  longer drive the calculator's current-purchase output.
                </li>
              </ul>
              <p className="pt-2">
                We deliberately did not attempt to re-verify every MSRP on the
                April 2026 refresh cycle. Directional accuracy is the goal —
                if you're deciding between two vehicles that are $2,000 apart
                in our data, the right move is to check current dealer
                inventory in your area, not to trust our number to the dollar.
              </p>
              <p>
                Three-letter confidence on this one:{" "}
                <ConfidenceTag level="approximate" /> across the fleet.
              </p>
            </div>
          </Section>

          <Section
            title="Known gaps and caveats"
            summary="What we haven't verified, and where users should double-check."
          >
            <ul className="text-sm text-ink-muted list-disc pl-5 space-y-2 leading-relaxed">
              <li>
                <strong>Wheeling Power tariffs</strong> were not retrievable on
                the April 2026 refresh; residential rate and customer charge
                shown are estimates based on parity with AEP.
              </li>
              <li>
                <strong>Rural coop rates</strong> are estimates; the v1 UI
                directs coop members to contact their cooperative rather than
                relying on these numbers.
              </li>
              <li>
                <strong>ZIP-prefix service territory mapping</strong> between
                utilities is a heuristic — the real boundaries are account-level
                and not publicly published in a clean form. A user on the edge
                of two territories may resolve to the wrong utility; the UI
                should encourage them to confirm against their actual bill.
              </li>
              <li>
                <strong>Vehicle MSRPs</strong> are MY2025 base-trim
                approximations and do not reflect dealer markups, discounts,
                or incentives. Not individually re-verified this cycle.
              </li>
              <li>
                <strong>Tax credit transition rules</strong>: if a user is
                reviewing a past purchase made before 2025-09-30 under a
                binding contract, the old IRA credit rules may still apply to
                their filing. This calculator is scoped to current-purchase
                decisions.
              </li>
              <li>
                <strong>Federal §30C cliff</strong>: the home charger credit
                terminates June 30, 2026. Users planning an installation
                should factor timing into their decision.
              </li>
            </ul>
          </Section>

        </div>

        <footer className="mt-12 pt-6 border-t border-slate-200 text-sm text-ink-soft">
          <p className="mb-2">
            Found a number that's wrong or stale? Please let us know — this
            page exists because we'd rather be corrected than confidently
            incorrect.
          </p>
          <p>
            <Link href="/calculator" className="text-brand hover:underline">
              ← Back to the calculator
            </Link>
          </p>
        </footer>
      </article>
    </main>
  );
}
