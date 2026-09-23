import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getFederalData, getUtilities } from "@/lib/data";

export const metadata: Metadata = {
  title: "State of the Data",
  description:
    "Every number on GoEV WV — utility rates, tax credits, state fees, and assumptions — with sources, retrieval dates, and confidence levels. A transparent audit trail of where our calculator's inputs come from.",
};

const LAST_REVIEWED = "September 23, 2026";

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
  const dcfc = federal.calculation_notes.dcfc_rate_per_kwh;
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
                directly retrieved, or values vary across the population we&rsquo;re
                summarizing.
              </span>
            </li>
            <li>
              <ConfidenceTag level="pending" />{" "}
              <span className="ml-1">
                — we&rsquo;ve flagged this for verification and it should be
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
              source="IRS — Credits for new clean vehicles"
              sourceUrl="https://www.irs.gov/credits-deductions/credits-for-new-clean-vehicles-purchased-in-2023-or-after"
              retrieved="2026-09-23"
              confidence="verified"
              notes="The One Big Beautiful Bill Act (P.L. 119-21, enacted July 4, 2025) terminated the §30D credit. A taxpayer with a written binding contract and payment made on or before September 30, 2025 can still claim the credit even if the vehicle is placed in service later. Not reinstated as of this review. The calculator treats the credit as unavailable."
            />
            <SourceRow
              label="IRC §25E — Used clean vehicle credit (30% / $4,000 max)"
              value="TERMINATED for vehicles acquired after 2025-09-30"
              source="IRS FAQ on P.L. 119-21 (OBBB)"
              sourceUrl="https://www.irs.gov/newsroom/faqs-for-modification-of-sections-25c-25d-25e-30c-30d-45l-45w-and-179d-under-public-law-119-21-139-stat-72-july-4-2025-commonly-known-as-the-one-big-beautiful-bill-obbb"
              retrieved="2026-09-23"
              confidence="verified"
              notes="Same termination date as §30D. A July 2026 Senate draft bill would restore the used-EV credit through 2031; it has not been enacted."
            />
            <SourceRow
              label="IRC §30C — Home EV charger credit (30% / $1,000 max)"
              value="EXPIRED — not available for installs after 2026-06-30"
              source="IRS — Alternative fuel vehicle refueling property credit"
              sourceUrl="https://www.irs.gov/credits-deductions/alternative-fuel-vehicle-refueling-property-credit"
              retrieved="2026-09-23"
              confidence="verified"
              notes="Not allowed for any property placed in service after June 30, 2026 — residential and commercial alike. There is no federal tax credit for a home charger installed today."
            />
            <SourceRow
              label="IRC §45W — Commercial clean vehicle credit"
              value="TERMINATED for vehicles acquired after 2025-09-30"
              source="IRS — Commercial clean vehicle credit"
              sourceUrl="https://www.irs.gov/credits-deductions/commercial-clean-vehicle-credit"
              retrieved="2026-09-23"
              confidence="verified"
              notes="Relevant to a future business/fleet mode: no federal credit is available for new commercial EV purchases."
            />
            <SourceRow
              label="Proposed federal EV registration fee"
              value="Pending — $130/yr BEV, $35/yr PHEV (not law)"
              source="H.R. 8870, BUILD America 250 Act"
              sourceUrl="https://www.congress.gov/bill/119th-congress/house-bill/8870"
              retrieved="2026-09-23"
              confidence="verified"
              notes="Passed the House Transportation & Infrastructure Committee 62–2 on May 22, 2026; no floor vote as of this review. Would rise $5 every two years from 2029 (caps $150 / $50). Current highway law was extended to December 11, 2026. Not included in the calculator unless it becomes law."
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
                $51.50 base — we&rsquo;re comparing the incremental cost of going
                electric, not the total DMV bill.
              </p>
            </div>
            <SourceRow
              label="BEV annual surcharge (added to TCO)"
              value={`$${federal.wv_state_fees.bev_annual_fee.amount_usd}/year`}
              source="WV Code §17A-10-3c"
              sourceUrl="https://code.wvlegislature.gov/17A-10-3c/"
              retrieved="2026-09-23"
              confidence="verified"
              notes="Unchanged since 2017 and not indexed. A 2026 bill (HB 4838) to raise it to $400 died in committee. At 10,000 miles/year this works out to 2.0¢/mile in state road tax, vs. ~1.4¢/mile that a 25-mpg gasoline vehicle pays at the current WV fuel tax rate."
            />
            <SourceRow
              label="PHEV annual surcharge (added to TCO)"
              value={`$${federal.wv_state_fees.phev_annual_fee.amount_usd}/year`}
              source="WV Code §17A-10-3c"
              sourceUrl="https://code.wvlegislature.gov/17A-10-3c/"
              retrieved="2026-09-23"
              confidence="verified"
              notes="Applies to vehicles operating on a combination of electricity and petrochemical fuels. A 2019 news report found the WV DMV also charging it to a conventional (non-plug-in) hybrid; we haven't confirmed current DMV practice. Statute enacted via Enrolled SB 1006 (2017 First Special Session)."
            />
            <SourceRow
              label="Standard Class A base registration (paid by all vehicles)"
              value={
                federal.wv_state_fees.standard_registration_fee
                  ? `$${federal.wv_state_fees.standard_registration_fee.amount_usd.toFixed(2)}/year`
                  : "$51.50/year"
              }
              source="WV registration fee guides (2026)"
              sourceUrl="https://westvirginialicenseplate.org/vehicle-registration-fees"
              retrieved="2026-09-23"
              confidence="approximate"
              notes="Includes $1.00 litter fee and $0.50 insurance fee. The WV DMV's own fee brochure link is currently broken, so this was confirmed only against secondary guides. Paid by every Class A passenger vehicle regardless of powertrain — which is why the calculator doesn't add it to either side of the EV-vs-gas comparison."
            />
            <SourceRow
              label="WV state EV purchase incentives"
              value="None"
              source="AFDC West Virginia laws registry"
              sourceUrl="https://afdc.energy.gov/laws/all?state=WV"
              retrieved="2026-09-23"
              confidence="verified"
              notes="West Virginia does not offer state-level tax credits, rebates, or purchase incentives for new or used EVs. The only WV-level financial levers are utility rebates (see below), the $200/$100 EV/PHEV annual fee, and any local municipal programs not tracked here."
            />
          </Section>

          <Section
            title="Appalachian Power (AEP) — residential rates"
            summary="Southern and central West Virginia. Rates for bills rendered on or after September 1, 2026."
          >
            {aep ? (
              <>
                <SourceRow
                  label="Marginal energy rate (used for EV charging cost)"
                  value={`$${aep.residential.flat_rate_per_kwh.toFixed(4)}/kWh`}
                  source="AEP WV tariff (Sheet 38) and bill examples"
                  sourceUrl="https://www.appalachianpower.com/company/about/rates/wv"
                  retrieved="2026-09-23"
                  confidence="verified"
                  notes="Tariff Sheet 38 prices every kWh over 500/month at $0.161465 all-in: base 9.584¢ + fuel clause (ENEC) 5.857¢ + other riders 0.71¢. EV charging sits on top of household use, so this is the right marginal rate. Up from 15.6¢ in April after a +4% inflation adjustment (July 1, 2026) and an ENEC increase (September 1, 2026). AEP bill examples: 1,000 kWh = $183.07; 2,000 kWh = $344.53. Excludes municipal B&O/utility taxes."
                />
                <SourceRow
                  label="Monthly basic charge (fixed)"
                  value={`$${aep.residential.monthly_customer_charge.toFixed(2)}/month`}
                  source="AEP WV tariff, Sheet 5-1"
                  sourceUrl="https://www.appalachianpower.com/lib/docs/ratesandtariffs/WestVirginia/ENEC_Tariff_Sheets_Eff_9-1-26.pdf"
                  retrieved="2026-09-23"
                  confidence="verified"
                  notes="Effective July 1, 2026. Our April figure (~$20.73) was derived from bill examples and mistakenly folded in the higher price of the first 500 kWh. Not used in EV math — it's paid with or without an EV."
                />
                <SourceRow
                  label="Winter block rate"
                  value="$0.1271/kWh above 1,350 kWh in Dec–Feb"
                  source="AEP WV tariff, Sheets 5-1 and 38"
                  sourceUrl="https://www.appalachianpower.com/lib/docs/ratesandtariffs/WestVirginia/ENEC_Tariff_Sheets_Eff_9-1-26.pdf"
                  retrieved="2026-09-23"
                  confidence="verified"
                  notes="Homes with electric heat that cross 1,350 kWh in winter months pay less for the extra kWh, which makes some winter EV charging cheaper. The calculator does not model this, so it slightly overstates winter charging cost for those homes."
                />
                <SourceRow
                  label="Off-Peak EV Charging (Schedule PEV) — off-peak rate"
                  value={`~$${(aep.residential.tou_schedule?.off_peak_rate_per_kwh ?? 0).toFixed(4)}/kWh`}
                  source="AEP WV tariff, Sheet 22-1 (Schedule PEV)"
                  sourceUrl="https://www.appalachianpower.com/clean-energy/electric-cars/wv-off-peak"
                  retrieved="2026-09-23"
                  confidence="approximate"
                  notes="Off-peak base 5.685¢ plus riders. The tariff doesn't say which rider set applies to PEV (11.99¢ or 12.25¢); we use the higher. AEP's program web page still shows the older 12.9¢. Off-peak hours: 8pm–6am Mon–Fri, all day Sat/Sun and major holidays."
                />
                <SourceRow
                  label="Off-Peak EV Charging — on-peak rate"
                  value={`~$${(aep.residential.tou_schedule?.on_peak_rate_per_kwh ?? 0).toFixed(3)}/kWh`}
                  source="AEP WV tariff, Sheet 22-1 (Schedule PEV)"
                  sourceUrl="https://www.appalachianpower.com/clean-energy/electric-cars/wv-off-peak"
                  retrieved="2026-09-23"
                  confidence="approximate"
                  notes="On-peak base 17.077¢ plus riders. The calculator assumes TOU users charge 100% off-peak; any daytime charging hits this higher rate."
                />
                <SourceRow
                  label="Off-Peak EV Charging — separate meter basic charge"
                  value={`$${(aep.residential.tou_monthly_meter_charge ?? 0).toFixed(2)}/month`}
                  source="AEP WV tariff, Sheets 22-1 / 22-2"
                  sourceUrl="https://www.appalachianpower.com/clean-energy/electric-cars/wv-off-peak"
                  retrieved="2026-09-23"
                  confidence="verified"
                  notes="The EV circuit gets its own meter, which carries its own basic charge (also the minimum bill) — $168/year. New this refresh: the calculator now includes it when you pick the TOU option. At a ~4¢/kWh discount, TOU only breaks even above roughly 4,200 kWh/year of charging (about 13,000–14,000 EV miles). Also requires a licensed electrician to install the meter base (one-time cost, not modeled)."
                />
              </>
            ) : null}
          </Section>

          <Section
            title="Mon Power & Potomac Edison (FirstEnergy) — residential rates"
            summary="Northern WV (Mon Power) and the Eastern Panhandle / Potomac Highlands (Potomac Edison). Identical rates effective August 1, 2026."
          >
            {monPower ? (
              <>
                <SourceRow
                  label="Marginal energy rate (Mon Power and Potomac Edison)"
                  value={`$${monPower.residential.flat_rate_per_kwh.toFixed(4)}/kWh`}
                  source="FirstEnergy WV tariffs (Mon Power Schedule A; Potomac Edison Schedule R)"
                  sourceUrl="https://www.firstenergycorp.com/content/dam/customer/Customer%20Choice/Files/west-virginia/tariffs/WVMPRetailTariff.pdf"
                  retrieved="2026-09-23"
                  confidence="verified"
                  notes="Energy charge 12.023¢ (fuel is built in) + vegetation-management rider 1.189¢ + other riders ~0.34¢ = 13.55¢. Effective August 1, 2026 under Case 26-0508-E-42T — step 1 of a two-step increase; step 2 (June 1, 2027) adds roughly 0.4¢/kWh. Cross-checks against the PSC-reported average bill ($141.51). Our April figure (13.8¢, from an aggregator) was close; the 'rate zones' it described don't exist in the tariff."
                />
                <SourceRow
                  label="Monthly customer charge"
                  value={`$${monPower.residential.monthly_customer_charge.toFixed(2)}/month`}
                  source="Mon Power tariff Sheet 7-1; Potomac Edison Sheet 8-1"
                  sourceUrl="https://www.firstenergycorp.com/content/dam/customer/Customer%20Choice/Files/west-virginia/tariffs/WVMPRetailTariff.pdf"
                  retrieved="2026-09-23"
                  confidence="verified"
                  notes="Corrected from $8.00 in our April data. Not used in EV math."
                />
                <SourceRow
                  label="Potomac Edison service area"
                  value="Berkeley, Jefferson, Morgan, Hampshire, Mineral, Grant, Hardy, Pendleton counties"
                  source="Potomac Edison WV tariff (towns served)"
                  sourceUrl="https://www.firstenergycorp.com/content/dam/customer/Customer%20Choice/Files/west-virginia/tariffs/WVPERetailTariff.pdf"
                  retrieved="2026-09-23"
                  confidence="verified"
                  notes="New this refresh — Potomac Edison was previously missing from the utility list. Serves Martinsburg, Charles Town, Shepherdstown, Berkeley Springs, Romney, Moorefield, Petersburg and surrounding areas."
                />
                <SourceRow
                  label="EV time-of-use (TOU) rate"
                  value="Not offered in West Virginia"
                  source="Mon Power and Potomac Edison WV tariffs"
                  sourceUrl="https://www.firstenergycorp.com/content/dam/customer/Customer%20Choice/Files/west-virginia/tariffs/WVMPRetailTariff.pdf"
                  retrieved="2026-09-23"
                  confidence="verified"
                  notes="Neither WV tariff contains a vehicle-specific schedule. Potomac Edison's EV-only TOU rate is a Maryland program."
                />
              </>
            ) : null}
          </Section>

          <Section
            title="Wheeling Power — residential rates"
            summary="AEP subsidiary serving the northern panhandle. Same tariff and rates as Appalachian Power."
          >
            {wheeling ? (
              <>
                <SourceRow
                  label="Marginal energy rate"
                  value={`$${wheeling.residential.flat_rate_per_kwh.toFixed(4)}/kWh`}
                  source="Joint APCo/Wheeling Power tariff and AEP bill calculator"
                  sourceUrl="https://www.appalachianpower.com/lib/docs/ratesandtariffs/WestVirginia/ENEC_Tariff_Sheets_Eff_9-1-26.pdf"
                  retrieved="2026-09-23"
                  confidence="verified"
                  notes="Wheeling Power is still a separate company (tariff No. 21) but shares the tariff document and joint rate cases with Appalachian Power, and its residential rates are identical. Our April figures (16.5¢, $9.00) were unverified estimates and have been replaced."
                />
                <SourceRow
                  label="Monthly basic charge"
                  value={`$${wheeling.residential.monthly_customer_charge.toFixed(2)}/month`}
                  source="Joint APCo/Wheeling Power tariff"
                  sourceUrl="https://www.appalachianpower.com/lib/docs/ratesandtariffs/WestVirginia/ENEC_Tariff_Sheets_Eff_9-1-26.pdf"
                  retrieved="2026-09-23"
                  confidence="verified"
                />
                <SourceRow
                  label="Off-Peak EV Charging (Schedule PEV)"
                  value="Available — same rates and meter charge as AEP"
                  source="Wheeling Power tariff No. 21, Sheet 22-1"
                  sourceUrl="https://www.appalachianpower.com/clean-energy/electric-cars/wv-off-peak"
                  retrieved="2026-09-23"
                  confidence="approximate"
                  notes="Same rider-set ambiguity as AEP's Schedule PEV. Before this refresh the calculator's TOU checkbox was enabled for Wheeling Power but had no rates behind it, so it silently did nothing; that is now fixed."
                />
              </>
            ) : null}
          </Section>

          <Section
            title="Co-ops and small local utilities"
            summary="Rural electric co-ops, Black Diamond Power, and municipal utilities. Rates not verified."
          >
            <div className="text-sm text-ink-muted leading-relaxed mb-4">
              A handful of small utilities serve parts of rural West Virginia.
              Their rate schedules are unpublished or only available as scanned
              images, so we could not verify a per-kWh rate for any of them.
              The calculator uses a rough placeholder for these customers and
              tells them to check the per-kWh charge on their bill. The
              estimates below are average-bill rates from an aggregator (bill
              ÷ kWh), which include fixed charges and so overstate the true
              marginal rate somewhat.
            </div>
            {coops ? (
              <SourceRow
                label="Placeholder rate used by the calculator"
                value={`$${coops.residential.flat_rate_per_kwh.toFixed(3)}/kWh`}
                source="Rough midpoint of the aggregator figures below"
                retrieved="2026-09-23"
                confidence="pending"
                notes="Raised from 12¢ in April — the April figure was an unsupported guess, and every available data point is higher. Treat any result for a co-op member as rough."
              />
            ) : null}
            <SourceRow
              label="Harrison Rural Electrification Association"
              value="~$0.21/kWh average bill rate (unverified)"
              source="harrisonrea.com (tariff is a scanned PDF); findenergy aggregator"
              sourceUrl="https://www.harrisonrea.com"
              retrieved="2026-09-23"
              confidence="pending"
              notes="Serves parts of Harrison, Doddridge, Marion, Taylor, Barbour, Upshur, and Lewis counties. A rate-change filing is dated February 28, 2026."
            />
            <SourceRow
              label="Black Diamond Power"
              value="~$0.18/kWh average bill rate (unverified)"
              source="findenergy aggregator; WV PSC case docket"
              sourceUrl="https://www.blackdiamondpower.com"
              retrieved="2026-09-23"
              confidence="pending"
              notes="Investor-owned distributor (~4,900 customers in Clay, Raleigh, and Wyoming counties) that buys power from AEP. The PSC denied a rate increase and opened a general investigation in October 2025; outcome not found."
            />
            <SourceRow
              label="Craig-Botetourt Electric Cooperative"
              value="~$0.187/kWh average bill rate (unverified)"
              source="Cardinal News; findenergy aggregator"
              sourceUrl="https://www.cbec.coop"
              retrieved="2026-09-23"
              confidence="pending"
              notes="Serves ~495 members in Monroe County. A WV rate increase effective May 1, 2026 raised the average bill ~6.8%."
            />
            <SourceRow
              label="Municipal utilities (New Martinsville, Philippi)"
              value="Not found"
              source="City websites"
              retrieved="2026-09-23"
              confidence="pending"
              notes="Neither city publishes residential electric rates online."
            />
          </Section>

          <Section
            title="Utility rebates and EV programs"
            summary="What's currently available for WV EV owners through their utility."
          >
            <SourceRow
              label="Appalachian Power Go Electric — Level 2 charger rebate"
              value="$300 per ENERGY STAR Level 2 charger"
              source="TakeCharge WV — Go Electric"
              sourceUrl="https://takechargewv.com/programs/for-your-home/go-electric"
              retrieved="2026-09-23"
              confidence="verified"
              notes="Replaced the earlier Charge Forward program ($250 charger + $250 licensed-electrician bonus); there is no longer a separate electrician bonus. Limited to residential customers in Appalachian Power's WV territory. No end date posted. Not included in the calculator's numbers (home-charger cost isn't modeled yet)."
            />
            <SourceRow
              label="Wheeling Power EV rebate"
              value="Unconfirmed"
              source="TakeCharge WV — Go Electric"
              sourceUrl="https://takechargewv.com/programs/for-your-home/go-electric"
              retrieved="2026-09-23"
              confidence="pending"
              notes="The Go Electric program page names only Appalachian Power's territory. Wheeling Power customers should ask TakeCharge WV before counting on it."
            />
            <SourceRow
              label="Mon Power / Potomac Edison WV EV programs"
              value="None"
              source="FirstEnergy WV tariffs and AFDC registry"
              sourceUrl="https://afdc.energy.gov/laws/all?state=WV"
              retrieved="2026-09-23"
              confidence="verified"
              notes="Neither a charger rebate nor an EV TOU rate is offered in West Virginia."
            />
            <SourceRow
              label="WV school bus electrification reimbursement"
              value="10–15% reimbursement"
              source="AFDC West Virginia laws registry"
              sourceUrl="https://afdc.energy.gov/laws/all?state=WV"
              retrieved="2026-09-23"
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
              retrieved={federal.calculation_notes.gas_price_baseline_per_gal.retrieved ?? "2026-09-23"}
              confidence="verified"
              notes="AAA's WV average was $4.373 on September 23, 2026 — up from $3.96 a month earlier and $2.97 a year earlier (US average $4.47). Prices were climbing fast at this snapshot, so this default sits near a peak and makes EV savings look larger than in a typical year. Use the gas-price slider in the calculator to test lower prices. Metro spread was $4.27–$4.40."
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
            title="Insurance and maintenance assumptions"
            summary="Used only when you pick your current vehicle, so both sides of the comparison include them."
          >
            <SourceRow
              label="Gas-vehicle insurance (per vehicle)"
              value="$1,490–$2,630/year depending on model"
              source="2026 WV averages: NerdWallet ($2,144), Bankrate ($2,162), ValuePenguin ($2,148), Insurify ($1,862)"
              sourceUrl="https://www.valuepenguin.com/state-of-auto-insurance-2026"
              retrieved="2026-09-23"
              confidence="approximate"
              notes="Full coverage, 35–45-year-old driver with a clean record. Raised this refresh (sedans ×1.15, SUVs/minivans ×1.25, pickups ×1.08) — our April figures sat 25–30% below 2026 WV averages for SUVs. Your quote will differ; get a real one before deciding."
            />
            <SourceRow
              label="EV and plug-in hybrid insurance (by class and price)"
              value="Class base × (0.40 + 0.60 × price ÷ reference price) × brand factor"
              source="Insurify, ValuePenguin, MoneyGeek (2026); formula is our estimate"
              sourceUrl="https://insurify.com/car-insurance/report/electric-vehicle-insurance-costs/"
              retrieved="2026-09-23"
              confidence="approximate"
              notes="About 40% of a full-coverage premium (liability) doesn't depend on the car; the other 60% (collision/comprehensive) scales with its value. Class bases: sedan/hatchback $1,650 at a $30k price, SUV $1,900 at $36k, minivan $1,800 at $42k, truck $2,000 at $52k; the price factor is limited to 0.85–1.8. Tesla, Rivian, Lucid and Polestar get ×1.25 (ValuePenguin found Tesla/Rivian ~48% above other EVs). Examples: Nissan Leaf ~$1,650, Chevy Equinox EV ~$1,870, Tesla Model Y Standard ~$2,530, Model Y Premium ~$2,930, Lucid Air ~$3,710. Sanity checks: Insurify finds new EVs in WV about 4% cheaper to insure than new gas cars; MoneyGeek puts a WV Model Y at $2,747. Replaced a class-only estimate that ignored price."
            />
            <SourceRow
              label="Maintenance, repair and tires"
              value="Gas: model-specific · EV: tires $750–$1,250/48k mi, brakes $185–$320/100k mi, $115/yr misc"
              source="AAA Your Driving Costs 2026; BLS CPI (maintenance & repair +14% over two years); Argonne (2021)"
              sourceUrl="https://newsroom.aaa.com/2026/09/aaa-new-vehicle-ownership-costs-hit-12863-annually/"
              retrieved="2026-09-23"
              confidence="approximate"
              notes="Gas-vehicle oil, brakes and misc raised 15% and tires 5% for 2026 prices. EV tire prices raised to reflect EV-rated tires. Argonne found EV scheduled maintenance ~40% cheaper per mile; AAA's 2026 matched pairs show EVs 2–28% cheaper all-in."
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
              value={`$${dcfc?.current.toFixed(2) ?? "0.55"}/kWh walk-up · ~$${dcfc?.member_rate?.toFixed(2) ?? "0.43"}/kWh with a membership`}
              source="WV and neighboring-state fast-charging prices (dcfctracker.com, network apps)"
              sourceUrl="https://dcfctracker.com/states/wv"
              retrieved={dcfc?.retrieved ?? "2026-09-23"}
              confidence="approximate"
              notes="Raised from $0.48 in April. September 2026 snapshot: WV average across networks ~$0.52/kWh (56 sites); US non-member average ~$0.55; Tesla Supercharger for non-Tesla drivers ~$0.62 walk-up in WV, ~$0.44 with a ~$13/month membership; Electrify America guest pricing $0.54–$0.63 in neighboring states (EA no longer lists prices on its website — the app is authoritative). Ionna caps at $0.39 but has no WV sites yet. The calculator uses the walk-up rate."
            />
            <SourceRow
              label="kWh delivered per DCFC stop"
              value="Only what the trip actually needs (capped at 70% of battery per stop)"
              source="Scaled to real driver behavior — top off to reach next checkpoint, not full 10→80%"
              retrieved="Revised 2026-04-21"
              confidence="verified"
              notes="Charging past ~80% slows dramatically as the charge curve tapers. The 10→80% window (70% of battery kWh) is the upper bound per stop, but most stops on a borderline trip deliver much less — only the overshoot beyond the home-charged first leg. Computed as (extra miles beyond first-leg window) × highway efficiency, clamped to annual kWh."
            />
            <SourceRow
              label="Per-stop time overhead"
              value="+4 minutes of plug-in / auth / unplug per stop"
              source="Industry-typical (plug-in, authentication, session init, unplug)"
              retrieved="Calculation methodology set 2026-04-18"
              confidence="verified"
              notes="Each stop's displayed time = (charging minutes scaled to actual kWh delivered, using the vehicle's spec 10→80% rate as the reference) + 4 min of fixed overhead. Real-world networks vary 3–8 min for authentication and session handling; 4 min is a conservative mid-point. A short top-up on a borderline trip might only add 5 min of charging, not the full 10→80% window."
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
              notes="Derived from ~4 cold WV months experiencing ~28% range loss, averaged into an annual multiplier. Toggleable in the UI; default on. Recurrent's November 2025 study of 30,000+ vehicles found ~22% range loss at 32°F and ~30% at 20°F (heat pumps help ~10%); WV winter days cluster around freezing, so 28% remains slightly conservative. Re-checked 2026-09-23."
            />
            <SourceRow
              label="PHEV electric/gas split"
              value="Electric until the battery's range is used each day, then gas"
              source="Argonne National Lab / INL fleet data"
              retrieved="Calculation methodology set 2026-04-18"
              confidence="verified"
              notes="Assumes the car is plugged in every night. Each commute day uses min(round trip, electric range) electric miles; each long road trip gets one battery's worth. With the winter derate on, electric range is reduced by the same ~12% that raises kWh per mile. Example: a 22-mile-range PHEV on an 80-mile commute runs ~23% electric; a 52-mile-range PHEV on a 30-mile commute runs ~85% electric. Owners who don't charge nightly get less — US DOE fleet studies (INL/Argonne) average about 65%. Replaced a fixed 65% split on 2026-09-23, which overstated savings for long commutes in short-range PHEVs."
            />
            <SourceRow
              label="WV grid CO₂ emissions factor"
              value="0.44 kg CO₂e/kWh"
              source="EPA eGRID2023 (rev 2), RFCW subregion, total output rate + 4.2% grid losses"
              sourceUrl="https://www.epa.gov/egrid/summary-data"
              retrieved="2026-09-23"
              confidence="verified"
              notes="Changed this refresh. Our April figure (0.67, attributed to EIA) matched neither official source. WV is part of the PJM grid and exports much of its coal power, so the regional mix is what a WV charger actually draws from; EPA and DOE use the eGRID subregion rate for EV emissions. EIA's WV in-state generation rate (1,912 lb/MWh = 0.87 kg/kWh, 2024) is a coal-only worst case. The calculator compares against EPA's direct tailpipe factor of 8.887 kg CO₂/gallon of gasoline."
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
              source="openchargemap.org API v3 (free API key required)"
              sourceUrl="https://openchargemap.org"
              retrieved="Refreshed on each site deploy — the map shows its retrieval date"
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
            summary="How we source MSRPs, EPA ranges, and efficiency for the 67 EVs and PHEVs in the picker."
          >
            <div className="text-sm text-ink-muted leading-relaxed space-y-3">
              <p>
                Vehicle specs are curated — not scraped — from the following
                sources, last re-verified September 2026:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>MSRPs:</strong> manufacturer websites and automotive
                  press for the current model year (2026 or 2027), excluding
                  destination fees. Actual transaction prices vary by region,
                  dealer incentive, and trim level. Refresh quarterly.
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
                  <strong>US/Canadian parts content:</strong> NHTSA&rsquo;s
                  MY2026 American Automobile Labeling Act report where listed;
                  several models aren&rsquo;t in it yet and show the prior-year
                  figure or none.
                </li>
                <li>
                  <strong>Availability:</strong> models whose production has
                  ended but still have new dealer inventory are labeled
                  &ldquo;Final model year.&rdquo; Models no longer sold new
                  (e.g., F-150 Lightning, Tesla Model S, Polestar 2, Jeep
                  Wrangler 4xe) stay in the picker for used-car shoppers,
                  labeled &ldquo;No longer sold new,&rdquo; with their last new
                  MSRP.
                </li>
                <li>
                  <strong>Tax credit eligibility flags:</strong> historical
                  (pre-OBBB). Retained in the dataset but the §30D credit is
                  terminated for post-2025-09-30 purchases, so these flags no
                  longer drive the calculator&rsquo;s current-purchase output.
                </li>
              </ul>
              <p className="pt-2">
                The September 2026 refresh re-checked every vehicle. A few
                values the manufacturer doesn&rsquo;t publish (Tesla battery
                sizes and charge times, some peak charging speeds) are
                estimates and say so in the vehicle&rsquo;s notes. Directional
                accuracy is the goal —
                if you&rsquo;re deciding between two vehicles that are $2,000 apart
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
                <strong>Co-op and small-utility rates</strong> could not be
                verified; the calculator uses a rough ~17¢/kWh placeholder for
                those customers.
              </li>
              <li>
                <strong>AEP / Wheeling Power off-peak EV rate</strong>: the
                tariff doesn&rsquo;t specify which riders apply, so the rate is
                a ±0.3¢ estimate, and AEP&rsquo;s own program page is out of
                date.
              </li>
              <li>
                <strong>Utility choice</strong> is up to you — the calculator
                doesn&rsquo;t look up your utility from your address. If
                you&rsquo;re unsure, check your electric bill.
              </li>
              <li>
                <strong>Plug-in hybrid electric share</strong> assumes nightly
                charging; owners who skip charging will use more gas than shown.
              </li>
              <li>
                <strong>Running costs only</strong>: results don&rsquo;t include
                purchase price, financing, or resale value. See the resale note
                on each vehicle.
              </li>
              <li>
                <strong>EV insurance</strong> is a formula-based estimate from
                class and price, not a quote.
              </li>
              <li>
                <strong>Vehicle MSRPs</strong> exclude destination fees, dealer
                markups, discounts, and incentives. Some specs are
                manufacturer projections pending EPA ratings (e.g., the 2026
                RAV4 Plug-in Hybrid).
              </li>
              <li>
                <strong>Interstate corridor station lists</strong> in the
                charging-status panel were last curated in April 2026; the
                statewide counts and NEVI status were refreshed in September
                2026.
              </li>
              <li>
                <strong>Tax credit transition rules</strong>: if you&rsquo;re
                reviewing a past purchase made before 2025-09-30 under a
                binding contract, the old IRA credit rules may still apply to
                your filing. This calculator is scoped to current-purchase
                decisions.
              </li>
            </ul>
          </Section>

        </div>

        <footer className="mt-12 pt-6 border-t border-slate-200 text-sm text-ink-soft">
          <p className="mb-2">
            Found a number that&rsquo;s wrong or stale? Please let us know — this
            page exists because we&rsquo;d rather be corrected than confidently
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
