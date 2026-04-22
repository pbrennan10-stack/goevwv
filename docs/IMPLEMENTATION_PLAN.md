# GoEV WV — Implementation Plan

**Project:** Interactive West Virginia EV advisory website
**Domain:** goevwv.com (registered at GoDaddy)
**Droplet IP:** 174.138.53.28
**Owner:** Patrick Brennan
**GitHub:** pbrennan10-stack
**Alert email:** pbrennan10@gmail.com
**Date drafted:** April 2026
**Last updated:** April 19, 2026 (v1.0.6 shipped — data accuracy pass + DCFC cost/time + long-range catalog)
**Status:** v1.0 + v1.0.5 + v1.0.6 live on goevwv.com. Auto-deploy on push to `main` is active via `.github/workflows/deploy.yml`. Open infra items: UptimeRobot, Next.js security patch, analytics choice. v1.1 (charger map + dealer directory) is the next feature.

---

## 1. Executive Summary

GoEV WV is a public, anonymous-use website that helps West Virginians (residential and small-business) decide whether an EV makes sense for them — new or used — tailored to West Virginia's utilities, rebates, dealer network, and charging infrastructure. The user enters their commute, picks vehicles to compare, and sees real numbers: fuel savings, payback period, home-charging setup cost, and utility-specific rate implications.

The site is designed around a low-maintenance operating model. Once deployed, updates happen by editing a single configuration file in a GitHub repository. Currently deploys are manual (`git pull && docker compose up -d --build` on the droplet); GitHub Actions auto-deploy is the next infrastructure step.

---

## 2. Goals & Success Criteria

**Primary goals**

1. Give a WV resident a defensible, transparent estimate of EV ownership cost vs. their current vehicle within 90 seconds of landing on the site.
2. Let a WV small-business owner model a 1–10 vehicle fleet transition with realistic assumptions for their utility and location.
3. Surface local, actionable next steps: nearby dealers, installers, chargers, and current rebate programs.
4. Serve used-EV shoppers with the same math and transparency as new-buyers — used-market pricing relevance is a first-class concern, not an afterthought.
5. Stay under $15/month in ongoing operating cost.
6. Require no more than ~1 hour/month of owner maintenance to keep data fresh.

**Measurable success criteria (6 months post-launch)**

- 500+ unique monthly visitors (analytics tool TBD — see §13)
- &lt;2 second page-load time on mobile (Lighthouse)
- Quarterly rebate/rate data-freshness check completed each quarter, documented on `/state-of-the-data`
- Zero unplanned downtime events &gt;1 hour

**Explicit non-goals (v1)**

- No user accounts, no passwords, no email collection
- No real-time vehicle inventory from dealers (stale data risk too high)
- No mobile app (responsive web only)
- No in-site transactions (referrals only)
- No automated scraping of utility tariffs (manual curation is more reliable)

---

## 3. User Personas

**Reba — Residential commuter (Charleston)**
Drives a 2015 Altima ~40 mi/day to work and back. Curious about the Equinox EV but worried about charging at her 1960s ranch house. Needs: transparent savings estimate, home charger install cost, local dealer contact.

**Derek — Small business owner (Morgantown)**
Runs a 4-van plumbing outfit. Fuel is eating his margins. Needs: realistic fleet TCO comparison, depot-charging feasibility, Mon Power commercial rate analysis, federal + state tax credit stacking (noting federal §30D is now terminated).

**Janet — Rural retiree (Pendleton County)**
Heard EVs "don't work out here." Needs: plain-English answer about whether a PHEV or BEV fits her mostly-local driving, with a coop-specific rate picture.

**Marcus — Used EV shopper (Huntington)** *(added v1.0.6)*
Thinking about a 2023 Tesla Model 3 or used Lucid Air off a dealer lot. Doesn't qualify for (and doesn't need) a federal credit — wants honest TCO based on current gas and electric rates, and wants to know how much the DCFC cost on road trips eats into the savings.

---

## 4. Feature Roadmap (Phased)

The MVP shipped fast, then features roll out in small, testable increments. Each phase is independently launchable.

### v1.0 — Core Calculator (shipped)

- Residential-only flow (business toggle hidden for now)
- Commute entry: home address + work address (geocoded via Mapbox)
- Vehicle comparison: pick up to 3 vehicles from a curated list (43 models as of v1.0.6)
- Utility selector: AEP, Mon Power, Wheeling Power, or "rural coop"
- Output card: annual fuel savings, 5-year TCO delta, CO₂ avoided, break-even month
- Shareable result URL (state encoded in query string, hydrated on load)
- Mobile-responsive, accessible, fast

### v1.0.5 — "I live here" enhancements (shipped)

A post-MVP round of WV-specific transparency and the narrative/decision framing that
generic EV calculators all miss. Shipped after live review showed users wanted a
more human, more local, more willing-to-say-no tool.

**FitCheck pre-calculator** — three-question fit quiz (home charging access, daily
miles, long-trip pattern) producing a plain-English verdict: `fit` / `likely` /
`maybe` / `notyet`. The `notyet` verdict is deliberately transparent — WV public
charging is too thin to support life without home charging today, and the tool
says so. Q3 distinguishes *routine* same-destination repeat trips from *varied*
destinations.

**Three-tier home charging framing** — portable Level 2 ($200–$500 on existing
240V outlet) as a middle path between permanent L2 install ($800–$3,200) and
standard 120V. Surfaced in FitCheck verdicts where it can flip a "not yet" into
a "yes."

**WV Charging Infrastructure section** — corridor-by-corridor status of
I-64, I-77, I-79, I-70, I-81 with coverage ratings, gap callouts, and NEVI
program status.

**Fueling time panel** — translates annual miles into lived time: hours at the
pump vs. passive home charging vs. active DCFC time on long trips.

**Realistic highway range** — DCFC stop calculator uses a curated
`highway_range_mi` per vehicle (not EPA combined). Tesla gets ~35% off EPA; other
BEVs derate ~15–20%. Math models asymmetric usable windows: first tank from home
uses 90% (100% → 10% SOC); subsequent DCFC stops use 70% (80% fast-charge cap →
10% SOC).

**Route-specific long-trip distance** — user enters actual one-way distance
(default 200 mi, range 50–600).

**Side-by-side baseline vs EV comparison** — current-vehicle card renders in the
same grid as EV cards with identical row labels and order.

**Gas price sensitivity slider** — recalculates 5-year savings at any gas price
from $2–$6/gal.

**NHTSA American-Made Index data** — per-vehicle US/Canadian parts content
percentage and assembly location from NHTSA MY2025 AALA document.

**Six extended-range variants added** — F-150 Lightning (320 mi), Mach-E Premium
ER (320 mi), Ioniq 5 LR (303 mi), EV6 Wind LR (310 mi), ID.4 Pro S (291 mi),
Rivian R1T Large Pack (352 mi).

**Printable report** — `/report` route renders a clean, shareable summary with
print CSS and a "Copy share link" button.

**Transparency guardrails** — range warning tiers, towing range penalty note,
resale depreciation note, PJM grid note (as the grid cleans up, EV emissions
fall automatically), route-helper round-trip fix, TOU methodology note.

**Why EVs Matter essay** — `/about` presented as editorial with numbered
sections, pull quotes, brand-color accents.

### v1.0.6 — Data accuracy & transparency pass (shipped April 19, 2026)

**Data corrections** (verified against authoritative sources):

- WV BEV fee corrected **$250 → $200** per WV Code §17A-10-3c and AFDC registry.
  The $250-ish figure common in casual sources is the *total* annual registration
  for a BEV ($51.50 base + $200 surcharge = $251.50 total); the statute surcharge
  is $200. Calculator uses $200 since the ICE baseline also excludes the base.
- Gas price baseline **$3.15 → $3.90** (AAA West Virginia average, April 2026).
- **Federal §30D and §25E terminated** for vehicles acquired after 2025-09-30 per
  P.L. 119-21 (OBBB, enacted July 4, 2025). Calculator no longer applies the
  $7,500 credit to new-purchase math.
- **Federal §30C (home/commercial charger credit) terminates 2026-06-30** — a
  near-term deadline flagged in Assumptions and on the State of the Data page.
- Mon Power WV EV rebate placeholder removed (AFDC + FirstEnergy direct confirm
  no program). Charge Forward L2 rebate confirmed active with no stated end
  date (previous "expires 2024-12-31 VERIFY" flag cleared).

**New `/state-of-the-data` route** — collapsible per-source audit trail for every
rate, fee, credit, and calculation assumption. Each row shows value, source URL,
retrieval date, and a Verified / Approximate / Pending confidence tag. Covers:
federal credits, WV state fees (including the $51.50 base + surcharge breakdown),
AEP / Mon Power / Wheeling / rural coop rates, utility rebates and programs, gas
price baseline, DCFC assumptions, calculation constants, vehicle data methodology,
and known gaps.

**Opening-page / calculator route split** — `/` is now hero + FitCheck + CTA
button to `/calculator`; the calculator lives at `/calculator` as its own route
with ChargingStatus panel alongside. Nav normalized to 4 items across every
page: Home · Calculator · Why EVs Matter · State of the Data. FitCheck's
verdict screen CTA prefills the calculator's daily-miles via `?mi=` query
param.

**DCFC cost + charge-time accuracy** — BEV energy split into home-rate kWh
(commute + long-trip first tank) and DCFC-rate kWh (mid-route charging stops)
at **$0.48/kWh** (Electrify America Pass walk-up, conservative no-subscription
default). Long-trip miles now flow symmetrically into both baselines — ICE gas
cost and BEV energy both scale across commute + road trips. DCFC stop time
layers a 4-min plug-in/auth/unplug overhead plus 8% annualized winter slowdown
(when winter derate toggle is on). BEV result cards show a `↳ DCFC` sub-row
in the cost breakdown with kWh and effective $/kWh.

**Long-range EV additions (39 → 43 vehicles)** — Lucid Air Grand Touring (512 mi
EPA, market range champion), Lucid Gravity Grand Touring (450 mi, 3-row SUV, 400
kW DCFC), Mercedes-Benz EQS 450+ Sedan (390 mi, 118 kWh pack), Tesla Model S
Long Range (410 mi). All four also serve the used-market shopper — Lucid and
EQS early-adopter depreciation has been steep, making them interesting on the
used market at a fraction of MSRP.

**Copy cleanup** — reduced tagline repetition of "honest" (8 → 5 user-facing
uses); SEO meta, Open Graph description, and ChargingStatus heading now use
"impartial." Hero subtitle link swapped "WV" → "USA" for the Why EVs Matter
essay (the argument is USA-scale). FitCheck and disclaimer "honest" uses
preserved where rhetorically load-bearing.

### v1.1 — Charger & Dealer Map (next)

- Interactive WV map showing public chargers (OpenChargeMap data, cached daily)
- Filter by connector type (CCS, NACS, CHAdeMO) and speed (L2, DCFC)
- Curated dealer/installer directory as map overlay + list
- "Distance from your route" filter
- Mapbox is already wired and credentialed; OpenChargeMap is free and keyless
- **Investigate NREL Alternative Fuels Data Center station API**
  (developer.nrel.gov/docs/transportation/alt-fuel-stations-v1/) as either a
  replacement for or second source alongside OpenChargeMap. NREL is
  government-maintained (DOE), arguably more authoritative for US stations,
  has a documented schema, and offers a free API key with generous quotas.
  Open questions: WV coverage completeness vs. OCM, connector/power field
  mapping, update cadence. If coverage is comparable, either swap or
  cross-reference both and flag stations that appear in only one source.

### v1.2 — Rebates, §30C Countdown, Used-EV Angle (revised scope)

Original v1.2 featured a "Federal IRA tax-credit eligibility checker" — that's
now obsolete since §30D and §25E were terminated 2025-09-30 by OBBB. Revised
scope:

- **§30C home charger credit countdown** — prominent deadline tracker for the
  2026-06-30 termination; eligibility walkthrough (30% of cost up to $1,000,
  residential census-tract requirement), applicable to installs placed in
  service before the cliff
- **Per-utility rebate detail pages** — one route per utility with current
  programs, eligibility, and how to apply (deeper than the utility picker
  currently shows)
- **TOU vs flat-rate explainer with break-even calculator** — meaningful for
  AEP customers since AEP is the only WV utility with a standing residential EV
  TOU tariff
- **Used-EV focus page** — per Marcus persona; factors depreciation curves,
  battery health concerns, "did this model qualify for §30D when new" historical
  lookup for buyers evaluating used inventory
- **Optional Decap CMS admin** at `/admin` for YAML-averse editing (still a good
  idea, deferred but tracked)

### v2.0 — Business Mode Toggle

- Top-of-page toggle: Residential / Business
- Business mode: multi-vehicle fleet input, depot charging sizing, demand-charge
  modeling, commercial tariff comparison
- Depreciation and Section 179/Bonus depreciation modeling
- PDF-exportable TCO report

### Post-v2 candidates (documented, not committed)

- WV-specific "dealer of the month" editorial content
- User-submitted charger reviews (moderated)
- Spanish translation
- Fleet electrification case studies from real WV small businesses

---

## 5. Technical Architecture

The stack is chosen around one priority: **minimize what you have to manage.**

**Current stack**

- **Next.js 14** (App Router, React + Node.js) — single codebase handles frontend and data-loading server components
- **Docker + Docker Compose** — the entire app runs as one `docker compose up -d` command
- **Caddy** as reverse proxy — automatic Let's Encrypt SSL certificate issuance and renewal
- **GitHub** for code + content — edits to rebate/rate data live in the same repo as code
- **Static YAML/JSON data files** (`data/utilities.yaml`, `data/federal.yaml`, `data/vehicles.json`, `data/ice_vehicles.json`, `data/charging_corridors.yaml`) loaded at build time by server components
- **Tailwind CSS** for styling, no CSS-in-JS runtime cost
- No analytics yet (decision pending — see §13)

**Deferred / not yet in the stack**

- **SQLite via `better-sqlite3`** — originally planned for v1, deferred because v1 is fully static/stateless. Will revisit when we add usage counters, saved reports, or similar.
- **Analytics** — GA4 free vs. Plausible $9/mo decision still open.
- **UptimeRobot monitoring** — free tier, not yet configured.

**Key third-party APIs**

| Service | Purpose | Cost |
|---|---|---|
| Mapbox | Maps + geocoding + routing | Free tier: 50k map loads/mo, 100k geocodes/mo |
| OpenChargeMap | Public charger data (v1.1) | Free |
| NHTSA vPIC | Vehicle spec lookup | Free, unlimited |
| AAA Gas Prices | Quarterly baseline refresh (manual) | Free |
| AFDC (energy.gov) | Rebate & incentive registry (manual) | Free |

**What we are NOT running**

- No Postgres server, no Redis, no message queue, no Kubernetes
- No separate auth service, no email service
- No server-side user tracking

Simplicity is a feature.

---

## 6. DigitalOcean Droplet (current state)

- **Basic Droplet** — $6/month (1 GB RAM, 1 vCPU, 25 GB SSD, Ubuntu 24.04 LTS)
- **DO weekly backups** — $1.20/mo, enabled
- **Region:** NYC3 (low latency to WV)
- **Droplet IP:** 174.138.53.28
- **Security posture:** UFW (22/80/443 only), fail2ban on SSH, unattended-upgrades for security patches, SSH key-only (no passwords), non-root runtime for the app container
- **SSL certs:** Caddy renews automatically via Let's Encrypt (keep the `caddy_data` volume intact — deleting it triggers rate limits on re-issuance)

### Deploy workflow (current — auto via GitHub Actions)

`.github/workflows/deploy.yml` fires on every push to `main`:

1. Checks out the SSH deploy key from the `DEPLOY_KEY` GitHub secret
2. SSHes to the droplet as `root@174.138.53.28`
3. Runs `git fetch origin && git reset --hard origin/main && docker compose up -d --build && docker compose ps`

Pushes typically reach production in ~60 seconds. Manual fallback (still works
if Actions is down):

```bash
ssh root@174.138.53.28
cd /opt/goevwv
git pull
docker compose up -d --build
```

### Hands-off maintenance currently in place

- **OS patches:** `unattended-upgrades` applies security updates nightly.
- **Backups:** DO weekly snapshots auto-run; restore is a button click.
- **SSL certs:** Caddy renews automatically, forever.

### Still needed

- **UptimeRobot** pinging `https://goevwv.com` every 5 min → email Patrick on
  downtime. Free tier, 10-minute setup.

---

## 7. Data Strategy

### Vehicle catalog

Curated `data/vehicles.json` — 43 models as of v1.0.6, spanning $28k Nissan Leaf
to $127k Lucid Air Grand Touring. Each entry holds: MSRP, EPA range, curated
winter range (28% derate), realistic highway range, city/highway efficiency,
battery kWh, home + DCFC charging specs (peak kW, 10→80% min, connectors),
seats, cargo, class, tax credit eligibility (historical), NHTSA AALA parts
content, assembly location/country, and notes. PHEVs in the catalog (Toyota
RAV4 Prime, Ford Escape PHEV, Jeep Wrangler 4xe, Toyota Prius Prime, BMW X5
xDrive50e) model the 65/35 electric/gas utility factor from Argonne fleet data.

### Utility rates & rebates

Curated `data/utilities.yaml` covers AEP (Appalachian Power), Mon Power
(FirstEnergy), Wheeling Power, and rural cooperatives. AEP is the best-verified
entry — rates derived directly from AEP's own bill examples (effective
2025-12-12) plus the Off-Peak EV Charging page. Mon Power confirmed no EV
rebate or TOU program. Wheeling Power rates remain approximate (utility site
was unreachable on the v1.0.6 refresh; WV PSC filings are the authoritative
fallback).

Editing rebates = editing one YAML file and pushing to GitHub.

### Federal + state constants

`data/federal.yaml` holds IRS credit status (both §30D and §25E marked
terminated with exact termination dates; §30C termination 2026-06-30 flagged),
WV state fees ($200 BEV surcharge / $100 PHEV surcharge / $51.50 Class A base,
all with statute citations), gas price baseline, DCFC rate ($0.48/kWh with
source URL and retrieval date), and calculation constants (winter derate, PHEV
split, grid CO₂ factor).

### Charger data

Deferred to v1.1. Will cache daily from OpenChargeMap API, filtered to WV
bounding box. Stored in-memory at build time initially; may migrate to SQLite
if the dataset warrants it.

### Dealer/installer directory

Deferred to v1.1. Manually curated `dealers.yaml` — ~30 WV dealerships + ~10
certified EVSE installers.

### Transparency mechanism

**`/state-of-the-data` page** (v1.0.6) is the canonical answer to "where does
this number come from?" Every rate, fee, credit, and assumption has a row with
source URL, retrieval date, and confidence tag. This replaces the originally
planned "Data is X days old" footer — it's more auditable and puts Patrick's
data-verification work in the open rather than hidden behind a timestamp.

### Content-freshness schedule

| Data type | How often it changes | Update mechanism |
|---|---|---|
| Vehicle MSRPs | 1–2x/year per model | Edit `vehicles.json`, push |
| Utility flat rates | 1–2x/year (PSC filings) | Edit `utilities.yaml`, push |
| Rebates | 2–4x/year | Edit `utilities.yaml`, push |
| Gas price baseline | Quarterly (AAA) | Edit `federal.yaml`, push |
| DCFC rate | Semi-annual | Edit `federal.yaml`, push |
| Chargers | Continuous (v1.1) | Auto via OpenChargeMap |
| Federal tax credits | Legislation-driven | Edit `federal.yaml`, push |

---

## 8. How Patrick Updates Data (Low-Skill Workflow)

1. Open the GitHub repo in your browser
2. Click the file you want to edit (e.g., `data/utilities.yaml`)
3. Click the pencil icon → edit → commit
4. Once GitHub Actions auto-deploy is set up (v1.1 infra goal), the live site
   will reflect the change in ~60 seconds. Until then, the change takes effect
   on the next manual SSH → `git pull && docker compose up -d --build`.

If editing YAML directly becomes a burden, **v1.2 can add a Decap CMS admin
page** at `/admin` for point-and-click editing.

---

## 9. Budget

| Item | Monthly |
|---|---|
| DigitalOcean Basic Droplet | $6.00 |
| DigitalOcean weekly backups | $1.20 |
| Domain (amortized from ~$12/yr) | $1.00 |
| Mapbox (free tier) | $0.00 |
| OpenChargeMap | $0.00 |
| GitHub (public repo) | $0.00 |
| UptimeRobot (free tier, when enabled) | $0.00 |
| Analytics (not yet chosen) | $0.00–$9.00 |
| **Total** | **~$8.20–$17.20/mo** |

Running well under the $15 target if we choose GA4 (free); Plausible ($9/mo)
would push above but still affordable.

---

## 10. Milestone Status

| Milestone | Status |
|---|---|
| Droplet provisioned, domain pointed, Coming Soon live | Done |
| v1.0 core calculator | Done |
| v1.0.5 "I live here" enhancements | Done |
| v1.0.6 data accuracy pass + DCFC split + long-range catalog | Done (April 19, 2026) |
| GitHub Actions auto-deploy (`.github/workflows/deploy.yml`) | Done |
| Next.js 14 security patch (CVE from Dec 2025 advisory) | Open |
| UptimeRobot monitoring | Open |
| Analytics decision (GA4 vs. Plausible) | Open |
| Trim-package audit (especially Rivian R1T/R1S Standard/Large/Max pack sizes, and cross-check all variant-group entries for pack kWh, range, 0-60, MSRP consistency with current OEM spec sheets) | Open |
| v1.1 charger map + dealer directory | Not started |
| v1.2 rebate explainer + §30C countdown + used-EV page | Not started |
| v2.0 business mode + fleet TCO | Not started |

---

## 11. Risks & Mitigations

**Stale rate/rebate data.** Utilities and legislatures change things on their
own schedule. Mitigation: `/state-of-the-data` page with per-row retrieval
dates; quarterly refresh cadence tracked in Patrick's calendar.

**Federal credit landscape shifts.** OBBB (2025) terminated §30D and §25E; a
future administration or Congress may reinstate them. Mitigation: the
`active` flag on each credit in `federal.yaml` is a one-line toggle — if
credits return, flipping that flag updates the calculator immediately.

**Financial-advice liability.** This is a planning tool, not professional
advice. Mitigation: clear disclaimer on every results page, plain language
framing ("estimate," "approximate"), assumptions expandable on every
calculation, per-source audit trail at `/state-of-the-data`.

**API quota blow-out.** If the site unexpectedly goes viral, Mapbox free tier
could be exceeded mid-month. Mitigation (v1.1): server-side caching of
geocoding, auto-fallback to Leaflet+OSM tiles if quota hits 80%.

**Droplet compromise.** Any internet-facing server is a target. Mitigation:
UFW firewall, SSH key-only auth, fail2ban, automatic security updates, weekly
backups, minimal attack surface (one app, no admin panel exposed).

**Next.js security advisory (14.2.15).** npm flags a known vulnerability (Dec
2025 advisory). Mitigation: version bump + smoke test is the next tactical
chore; tracked in §10.

**Data accuracy for rural coops.** Coop rates vary and are less public.
Mitigation: calculator shows "contact your coop" helper instead of falsely
precise numbers; `/state-of-the-data` marks all three coop rates as
Approximate.

**Patrick gets busy.** Mitigation: the site runs for months with zero
intervention. If nothing is updated for a year, it still works — with all
source retrieval dates visible, users can see exactly how stale the data is.

---

## 12. Historical — Pre-launch Requirements (archived)

*This section listed the 5 items needed to start week 0: droplet access, domain
access, GitHub account, branding confirmation, UptimeRobot email. All resolved
pre-launch. Retained here as project history.*

---

## 13. Open Questions

Carried forward from the original plan; remaining live items:

- **Analytics choice.** GA4 (free) vs. Plausible ($9/mo, privacy-friendly,
  self-hostable). Leaning GA4 for cost; Plausible if privacy-as-a-feature
  matters for positioning. Not yet installed.
- **Comments / "report incorrect data" mechanism.** A mailto link is the
  zero-infra option. An embedded form would need an email service (~$5–10/mo)
  or a forms-as-a-service provider.

Previously open, now resolved:
- PHEVs vs BEV-only → PHEVs included
- Public vs private GitHub repo → public
- About page existence and tone → built and expanded into Why EVs Matter essay

---

## 14. Next Immediate Steps

In rough priority order:

1. **Patch Next.js 14.2.15** — bump to the latest patched 14.x, run typecheck +
   build + a calculator smoke test, push (auto-deploys). Small blast radius,
   high security-hygiene value.
2. **UptimeRobot** — 5-min ping on `https://goevwv.com`, email alert to
   `pbrennan10@gmail.com`. Free tier, 10 minutes of setup.
3. **Analytics decision** (GA4 vs Plausible) — blocks being able to measure
   the marketing push.
4. **Marketing awareness round** — per Patrick's plan, partnerships with Solar
   Holler, Generation WV, WV Sierra Club + targeted Reddit posts in
   WV-specific subs + local press pitch. Do this once the Next.js patch ships,
   since each external link landing on goevwv.com is a one-shot first
   impression.
5. **v1.1 charger map** — OpenChargeMap integration with WV bounding box, Mapbox
   render, filters by connector/speed.
6. **`whyweare50th.com` DNS cleanup** — retire the old domain's A record still
   pointing at the droplet (tracked in CLAUDE.md).
7. **Clean up `VERIFY_BEFORE_LAUNCH` markers in data files** — *Done 2026-04-19.*
   All markers removed; `/state-of-the-data` is now the per-field confidence
   source of truth. `verify_before_display` field dropped from `UtilityRebate`
   type; `vehicles.json` `_meta` carries `confidence: "approximate"` instead.
