# GoEV WV — Implementation Plan

**Project:** Interactive West Virginia EV advisory website
**Domain:** goevwv.com (registered at GoDaddy)
**Droplet IP:** 174.138.53.28
**Owner:** Patrick Brennan
**GitHub:** pbrennan10-stack
**Alert email:** pbrennan10@gmail.com
**Date drafted:** April 18, 2026
**Last updated:** April 18, 2026 (v1.0.5 shipped)
**Status:** v1.0 + v1.0.5 live on goevwv.com. v1.1 (charger map + dealer directory) next.

---

## 1. Executive Summary

GoEV WV is a public, anonymous-use website that helps West Virginians (residential and small-business) decide whether an EV makes sense for them — tailored to West Virginia's utilities, rebates, dealer network, and charging infrastructure. The user enters their commute, picks vehicles to compare, and sees real numbers: fuel savings, payback period, home-charging setup cost, and utility-specific rate implications.

The site is designed around a low-maintenance operating model. Once deployed, updates happen by editing a single configuration file in a GitHub repository; the server rebuilds itself automatically. No manual SSH work is required for routine changes.

---

## 2. Goals & Success Criteria

**Primary goals**

1. Give a WV resident a defensible, honest estimate of EV ownership cost vs. their current vehicle within 90 seconds of landing on the site.
2. Let a WV small-business owner model a 1–10 vehicle fleet transition with realistic assumptions for their utility and location.
3. Surface local, actionable next steps: nearby dealers, installers, chargers, and current rebate programs.
4. Stay under $15/month in ongoing operating cost.
5. Require no more than ~1 hour/month of owner maintenance to keep data fresh.

**Measurable success criteria (6 months post-launch)**

- 500+ unique monthly visitors (Google Analytics or Plausible)
- &lt;2 second page-load time on mobile (Lighthouse)
- Quarterly rebate/rate data-freshness check completed each quarter
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
Drives a 2015 Altima ~40 mi/day to work and back. Curious about the Equinox EV but worried about charging at her 1960s ranch house. Needs: honest savings estimate, home charger install cost, local dealer contact.

**Derek — Small business owner (Morgantown)**
Runs a 4-van plumbing outfit. Fuel is eating his margins. Needs: realistic fleet TCO comparison, depot-charging feasibility, MonPower commercial rate analysis, federal + state tax credit stacking.

**Janet — Rural retiree (Pendleton County)**
Heard EVs "don't work out here." Needs: plain-English answer about whether a PHEV or BEV fits her mostly-local driving, with a coop-specific rate picture.

---

## 4. Feature Roadmap (Phased)

The MVP ships fast, then features roll out in small, testable increments. Each phase is independently launchable.

### v1.0 — Core Calculator (Weeks 1–3)

- Residential-only flow (business toggle hidden for now)
- Commute entry: home address + work address (geocoded)
- Vehicle comparison: pick up to 3 vehicles from a curated list (~20 models)
- Utility selector: AEP, Mon Power, Wheeling Power, or "rural coop"
- Output card: annual fuel savings, 5-year TCO delta, CO₂ avoided, break-even month
- Shareable result URL (state encoded in query string)
- Mobile-responsive, accessible, fast

### v1.0.5 — "I live here" enhancements (shipped April 2026)

A post-MVP round of WV-specific honesty and the narrative/decision framing that
generic EV calculators all miss. Shipped after live review showed users wanted a
more human, more local, more willing-to-say-no tool.

**FitCheck pre-calculator** — three-question fit quiz (home charging access, daily
miles, long-trip pattern) producing a plain-English verdict: `fit` / `likely` /
`maybe` / `notyet`. The `notyet` verdict is deliberately honest — WV public
charging is too thin to support life without home charging today, and the tool
says so. Q3 distinguishes *routine* same-destination repeat trips (become routine
after the first planning session) from *varied* destinations (ongoing planning
overhead) — a critical distinction the original design missed.

**Three-tier home charging framing** — most users don't realize a portable Level 2
charger ($200–$500, plugs into an existing 240V outlet like a dryer/welder/RV
hookup) is a viable middle path between a permanent L2 install ($800–$3,200
with electrician) and a standard 120V outlet (slow but workable for short
commutes). Surfaced in FitCheck verdicts where it can flip a "not yet" into a
"yes."

**WV Charging Infrastructure section** — corridor-by-corridor honest status of
I-64, I-77, I-79, I-70, I-81 with coverage ratings ("good" / "moderate" /
"thin"), gap callouts, and NEVI program status. WV's $45.7M NEVI allocation has
no RFP issued as of April 2026; earliest new stations 2027–2028. First WV EV
resource to say this plainly.

**Fueling time panel** — translates annual miles into concrete lived time: hours
per year at the pump vs. passive home charging time vs. active DCFC time on long
trips. Makes the daily-life comparison visible in a way no competitor tool does.

**Realistic highway range** — the DCFC stop calculator now uses a curated
`highway_range_mi` per vehicle (not EPA combined). Tesla gets the deepest derate
(~35% off EPA — Model 3 LR at 230 mi, Model Y LR at 210 mi) reflecting
well-documented real-world reports; other BEVs derate ~15–20%. Math models
asymmetric usable windows: first tank from home uses 85% (100% → 15% SOC);
subsequent DCFC stops use 65% (80% fast-charge cap → 15% SOC, reflecting that
charging past 80% is painfully slow).

**Route-specific long-trip distance** — user enters actual one-way distance
(Charleston→Pittsburgh ≈ 250 mi, →DC ≈ 350 mi) instead of a hardcoded 200 mi
assumption. Default 200, range 50–600.

**Side-by-side baseline vs EV comparison** — the current-vehicle card renders in
the same grid as the EV cards with identical row labels and order (fuel, fee,
maintenance, insurance, total, CO₂, MSRP, IRA credit, effective price, assembly,
parts %). Users can scan left-to-right across all options.

**Gas price sensitivity slider** — recalculates 5-year savings at any gas price
from $2–$6/gal, showing the delta vs. the baseline estimate.

**NHTSA American-Made Index data** — per-vehicle US/Canadian parts content
percentage and assembly location from the NHTSA MY2025 AALA document. Surfaces
non-obvious findings: Kia EV6 (West Point, GA) at 80% US/CA content vs. Chevy
Equinox EV (Canada-assembled) at 12%, Honda Prologue assembled in Mexico, etc.
Rendered on vehicle picker buttons and result cards.

**Six extended-range variants added** — larger battery trims for F-150 Lightning
(320 mi), Mach-E Premium ER (320 mi), Ioniq 5 LR (303 mi), EV6 Wind LR (310 mi),
ID.4 Pro S (291 mi), Rivian R1T Large Pack (352 mi). Often the WV-appropriate
choice given highway-range requirements.

**Printable report** — `/report` route renders a clean, shareable summary
(inputs + per-vehicle comparison + assumptions) with print CSS and a "Copy
share link" button. Inherits all URL state from the calculator. Letter-sized
page layout, serif-clean, no navigation chrome when printed.

**Honest guardrails added**:
- Range warning tiers — "EXCEEDS range" (not viable) vs. "close to range" (buffer advised)
- Towing range penalty warning for truck-on-truck comparisons + two-car household framing
- Resale depreciation note on each EV card (WV has ~1,900 registered EVs — thin local market)
- PJM grid note: WV is part of the 13-state PJM network; as the grid cleans up,
  EV emissions fall automatically. Gas-car emissions never change.
- Route-helper round-trip fix — entering home/work addresses now correctly doubles
  to round-trip mileage.
- TOU methodology: 100% off-peak rate assumed (users who opt into TOU charge overnight
  exclusively, which is the actual enrollment requirement).

**Why EVs Matter essay** — [`/about`](goevwv/app/about/page.tsx) is now presented as a
proper editorial piece: numbered sections (01–05), lead paragraph with brand-color
accent, pull quotes for thesis lines ("The battery is to the 21st century what
steel was to the 20th"). Renamed nav entry from "About" to "Why EVs Matter" and
added a kicker on the home page: *"Why I built this: an honest case for EV
adoption in WV →"*.

### v1.1 — Charger & Dealer Map (Weeks 4–5)

- Interactive WV map showing public chargers (OpenChargeMap data, cached daily)
- Filter by connector type (CCS, NACS, CHAdeMO) and speed (L2, DCFC)
- Curated dealer/installer directory as map overlay + list
- "Distance from your route" filter

### v1.2 — Rebates & Rate Explainer (Weeks 6–7)

- Utility-specific rebate page per utility (current programs, eligibility, how to apply)
- TOU vs flat-rate explainer with break-even calculator
- Federal IRA tax-credit eligibility checker (point-of-sale vs. return)
- State/federal rebate stacking examples

### v2.0 — Business Mode Toggle (Weeks 8–10)

- Top-of-page toggle: Residential / Business
- Business mode: multi-vehicle fleet input, depot charging sizing, demand-charge modeling, commercial tariff comparison
- Depreciation and Section 179/Bonus depreciation modeling
- Printable/PDF-exportable TCO report

### Post-v2 candidates (documented, not committed)

- WV-specific "dealer of the month" editorial content
- User-submitted charger reviews (moderated)
- Spanish translation
- Used-EV focus page (important for WV affordability)

---

## 5. Technical Architecture

The stack is chosen around one priority: **minimize what you have to manage.**

**Recommended stack**

- **Next.js 14** (React + Node.js) — single codebase handles frontend and API routes; mature, well-documented, large community
- **SQLite** via `better-sqlite3` — single file database, zero admin overhead, handles the traffic we expect for years
- **Docker + Docker Compose** — the entire app runs as one `docker compose up -d` command; perfectly isolated from anything else on the droplet
- **Caddy** as reverse proxy — automatic Let's Encrypt SSL certificate issuance and renewal, zero-config HTTPS
- **GitHub** for code + content — edits to rebate/rate data live in the same repo as code
- **GitHub Actions** for auto-deploy — push to `main` branch triggers a deploy-over-SSH step; droplet pulls and restarts the container
- **Plausible Analytics** (self-hosted or $9/mo cloud) or **Google Analytics 4** (free) — pick one; privacy-friendly Plausible is recommended if budget allows later

**Key third-party APIs**

| Service | Purpose | Cost |
|---|---|---|
| Mapbox | Maps + geocoding + routing | Free tier: 50k map loads/mo, 100k geocodes/mo |
| OpenChargeMap | Public charger data | Free |
| DSIRE | Rebate database reference | Free (manual + occasional API pulls) |
| NHTSA vPIC | Vehicle spec lookup | Free, unlimited |

If Mapbox free tier is ever exceeded, fallback is Leaflet + OpenStreetMap tiles (totally free, slightly less polished).

**What you are NOT running**

- No Postgres server
- No Redis
- No message queue
- No Kubernetes
- No separate auth service
- No email service

Simplicity is a feature.

---

## 6. DigitalOcean Droplet Setup

### Droplet specs

**Recommendation: Basic Droplet — $6/month**

- 1 GB RAM, 1 vCPU, 25 GB SSD
- Ubuntu 24.04 LTS (x86)
- Region: NYC3 or TOR1 (low latency to WV)
- Enable **Backups** ($1.20/mo) — weekly automatic snapshots

This is comfortably enough for Next.js + SQLite at projected traffic. If we later exceed it, resizing is a 30-second downtime event and costs an extra $6/mo.

### One-time server setup (I will script this end-to-end)

I will provide a single bootstrap script that runs on a fresh droplet and does all of the following:

1. Creates a non-root `deploy` user with SSH key auth
2. Disables root SSH and password SSH
3. Enables UFW firewall (ports 22, 80, 443 only)
4. Installs Docker + Docker Compose
5. Installs Caddy (for SSL) or uses Caddy inside Docker Compose
6. Installs fail2ban (brute-force protection)
7. Configures automatic security updates (`unattended-upgrades`)
8. Pulls the GoEV WV repo and launches it
9. Sets up a systemd timer for nightly SQLite backups to DO Spaces (optional, $5/mo if we want offsite backup; skipped in base budget)

**Your hands-on work for setup:** point your domain's DNS at the droplet IP and run one `curl | bash` bootstrap command. Total time: ~15 minutes.

### Ongoing maintenance (what "hands-off" actually means)

- **SSL certs:** Caddy renews automatically, forever.
- **OS patches:** `unattended-upgrades` applies security updates nightly.
- **App deploys:** Push a change to GitHub → deploys in 60 seconds.
- **Backups:** DO weekly snapshots run automatically; restore is a button click.
- **Monitoring:** Free UptimeRobot account pings the site every 5 minutes and emails you if it goes down.

The only thing you need to do on a routine basis is edit content files when rebates or rates change (see §8).

---

## 7. Data Strategy

### Vehicle catalog

A curated `vehicles.json` file in the repo. I will seed it with ~20 models that are realistic for West Virginians (Tesla Model 3/Y, Ford F-150 Lightning, Chevy Bolt / Equinox EV / Silverado EV, Hyundai Ioniq 5/6, Kia EV6, Rivian R1T, VW ID.4, Honda Prologue, Nissan Leaf, Toyota bZ4X, plus 2–3 PHEVs for range-anxious users). Each entry holds: MSRP, real-world range (EPA minus winter derating for WV), kWh/100mi, charging speeds, vehicle class.

### Utility rates & rebates

A curated `utilities.yaml` file, structured like:

```
aep:
  name: Appalachian Power
  residential:
    flat_rate_per_kwh: 0.1487
    tou_available: false
    ev_special_rate: null
  rebates:
    - name: "Level 2 Charger Rebate"
      amount: 250
      url: "https://..."
      expires: "2026-12-31"
  coverage_zips: ["24701", "25301", ...]
```

Editing rebates = editing one YAML file and pushing to GitHub. The site auto-deploys within a minute.

### Charger data

Cached daily from OpenChargeMap API, filtered to WV bounding box. Stored in SQLite. If OpenChargeMap is unavailable at cache time, the site serves the previous day's cache.

### Dealer/installer directory

Manually curated `dealers.yaml`. I will do the initial research (~30 WV dealerships + ~10 certified EVSE installers) as part of v1.1.

### Content-freshness strategy

| Data type | How often it changes | Update mechanism |
|---|---|---|
| Vehicle MSRPs | 1–2x/year per model | Edit `vehicles.json`, push |
| Utility flat rates | 1–2x/year (PSC filings) | Edit `utilities.yaml`, push |
| Rebates | 2–4x/year | Edit `utilities.yaml`, push |
| Chargers | Continuous | Auto via OpenChargeMap |
| Federal tax credits | 1x/year (or legislation) | Edit `federal.yaml`, push |

I will build a **"Data is X days old"** footer on each page so visitors (and you) can see freshness at a glance.

---

## 8. How You Update Data (Low-Skill Workflow)

You don't need to SSH in or run any commands to update data. The workflow is:

1. Open the GitHub repo in your browser
2. Click the file you want to edit (e.g., `utilities.yaml`)
3. Click the pencil icon → edit → commit
4. Within ~60 seconds, the live site reflects your change

If you'd prefer a web form instead of editing YAML directly, **v1.2 can add a free Decap CMS admin page** at `yourdomain.com/admin` that gives you a point-and-click editor. This is a well-supported option and adds no ongoing cost.

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
| UptimeRobot (free tier) | $0.00 |
| Google Analytics 4 | $0.00 |
| **Total** | **~$8.20/mo** |

Headroom within your $15/mo budget covers: a future email service ($0–10/mo if you add rebate alerts), Plausible Analytics upgrade ($9/mo), or droplet resize.

---

## 10. Timeline

Assumes ~part-time effort on my side and occasional review from you.

| Week | Deliverable |
|---|---|
| 0 | Droplet provisioned, domain pointed, bootstrap script run, "Hello WV" placeholder live |
| 1 | v1.0 scaffolding: route geocoding, vehicle selector UI, basic calc engine |
| 2 | v1.0 utility rate logic, result card, shareable URLs |
| 3 | v1.0 polish, mobile QA, analytics, **public launch** |
| 4–5 | v1.1: charger map + dealer directory |
| 6–7 | v1.2: rebate explainer + TOU calculator + optional Decap CMS admin |
| 8–10 | v2.0: business mode toggle + fleet TCO |
| 11 | Post-launch polish, content audit, first quarterly data refresh |

**Public launch target: end of week 3.** Everything after is iterative improvement on a live site.

---

## 11. Risks & Mitigations

**Stale rate/rebate data.** Utilities and legislatures change things on their own schedule. Mitigation: visible "data last updated" footer on every affected page, plus a quarterly calendar reminder I'll set up for you.

**Financial-advice liability.** This is a planning tool, not professional advice. Mitigation: clear disclaimer on every results page, plain language framing ("estimate," "approximate"), and an "assumptions" expandable on every calculation.

**API quota blow-out.** If the site unexpectedly goes viral, Mapbox free tier could be exceeded mid-month. Mitigation: server-side caching of geocoding, daily budget alerts, auto-fallback to Leaflet+OSM tiles if quota hits 80%.

**Droplet compromise.** Any internet-facing server is a target. Mitigation: UFW firewall, SSH key-only auth, fail2ban, automatic security updates, weekly backups, minimal attack surface (one app, no admin panel exposed to public internet).

**Data accuracy for rural coops.** Coop rates vary and are less public. Mitigation: v1.0 covers AEP, MonPower, Wheeling Power in depth; coops get a "contact your coop" helper card until we can curate their rates in v1.2+.

**You lose interest or get busy.** Mitigation: the site is designed to run for months with zero intervention. If nothing is updated for a year, it still works — it just shows older data with its "X days old" badge.

---

## 12. What I Need From You

To start week 0, I need:

1. **Droplet access**: add my SSH public key (I will provide one) to the droplet's root authorized_keys, OR run the bootstrap script yourself and give me `deploy` user access
2. **Domain access**: the domain is `goevwv.com` — confirmation that you have access to its DNS settings at whatever registrar you used (I'll walk you through the A-record setup)
3. **GitHub account**: you'll own the repo; I'll have collaborator access. If you don't have one, it's a 2-minute signup
4. **Confirmation of site name/branding**: GoEV WV? WV EV Advisor? Something else?
5. **An email address for UptimeRobot alerts** (can be your personal email)

That's it to get started.

---

## 13. Open Questions / Decisions to Revisit

These do not block v1 but we should decide before v1.2:

- Do you want a comments/feedback mechanism (e.g., a "report incorrect data" button emailing you)?
- Preferred analytics: free GA4 vs. paid privacy-friendly Plausible ($9/mo)?
- Public vs. private GitHub repo? (Public unlocks free GitHub Actions minutes, but config data will be visible — none of it is sensitive.)
- Do you want to include PHEVs and hybrids in comparisons, or BEV-only?
- Should the site have an "about / who made this" page, and what should it say?

---

## 14. Next Steps

If this plan looks right:

1. Reply "approved" (or with edits) and I'll produce a written week-0 runbook
2. Provide the 5 items in §12
3. We'll schedule a ~30-minute setup session where I walk you through pointing the domain and running the bootstrap

If this plan is too much or too little, let me know which parts to cut or expand.
