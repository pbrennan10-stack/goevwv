# GoEV WV — Context for Claude Code

**Live site:** https://goevwv.com
**Repo:** https://github.com/pbrennan10-stack/goevwv
**Owner:** Patrick Brennan (pbrennan10@gmail.com)
**Droplet:** 174.138.53.28 (DigitalOcean, Ubuntu 24.04 LTS)

## What this project is

A West Virginia-specific EV advisor. Users enter commute + utility + current vehicle and see honest TCO numbers for 1–3 EVs/PHEVs, factoring in WV utility rates, cold-winter range derating, the WV $200 annual EV fee, TOU rates where available, and federal IRA credits. No user accounts, no tracking beyond basic analytics; all calculations are client-side.

Audience is both residential drivers and (by v2) WV small-business fleets.

## Stack

- **Next.js 15** App Router + React 19 + TypeScript + Tailwind
- **Node.js 20** (Alpine in Docker)
- **Data files** under `data/` — curated JSON/YAML, edited via git commits (no CMS yet)
- **Docker + Caddy** — Caddy handles TLS via Let's Encrypt automatically
- **SQLite** (planned, not yet used — v1 is fully static/stateless)
- **Mapbox** (planned, not yet wired) — for geocoding and routing in v1.1

Intentional non-choices: no Postgres, Redis, auth, email, or background workers. Keep the infra boring.

## Required env vars (build-time)

- **`NEXT_PUBLIC_MAPBOX_TOKEN`** — Mapbox token for RouteHelper (geocoding/directions) and ChargerMap rendering. Embedded in the client bundle at build.
- **`OPENCHARGEMAP_API_KEY`** — Free key from openchargemap.org. Used server-side to fetch the WV charger list for `/chargers`, both at build time and by the daily background refresh (so docker-compose passes it to the running container too). Without it at build, the page shows a graceful "temporarily unavailable" fallback; a failed daily refresh keeps the last good page.

- **`NEXT_PUBLIC_GOATCOUNTER_CODE`** (optional) — GoatCounter site code (the `xyz` in `xyz.goatcounter.com`). When set, the root layout loads GoatCounter's cookie-free page counter; when unset, no analytics script loads.

Locally these live in `.env.local` (gitignored). On the droplet they live in `/opt/goevwv/.env`, read by `docker compose` and forwarded as build-args per `docker-compose.yml`.

## Repo layout

```
goevwv/
├── app/                # Next.js App Router
│   ├── layout.tsx      # Root layout, metadata, viewport
│   ├── page.tsx        # Landing + fit check
│   ├── plan/           # Household planner (whole driveway, purchase price, trips)
│   ├── calculator/     # Single-vehicle calculator
│   ├── ev/             # /ev index + /ev/[id] static guide page per vehicle (SEO)
│   ├── utilities/      # /utilities index + /utilities/[id] EV rate page per utility
│   ├── faq/            # WV EV FAQ built from data/* (FAQPage JSON-LD)
│   ├── chargers/, about/, state-of-the-data/, report/
│   └── globals.css     # Tailwind base
├── components/
│   ├── HouseholdPlanner.tsx # /plan client UI (4 steps; state in ?h= URL param)
│   ├── Calculator.tsx  # Single-vehicle calculator: form + picker + results
│   ├── SiteHeader.tsx / SiteFooter.tsx  # Shared nav + footer (add new pages here)
│   ├── AiDataNotice.tsx # "AI-assisted data, may contain errors" notice
│   └── Logo.tsx, FitCheck.tsx, ChargerMap.tsx, RouteHelper.tsx, …
├── lib/
│   ├── types.ts        # TS types (Vehicle, Capability, Utility, FederalData, …)
│   ├── data.ts         # Server-only: loads data/*.json and data/*.yaml
│   ├── calc.ts         # Per-vehicle TCO math + formatters (shared by planner)
│   ├── household.ts    # Household planner engine (assignment, fit, ownership cost)
│   ├── capability.ts   # Seats/cargo/towing helpers, cargo-miles index
│   └── scenario.ts     # "Typical WV driver" defaults for /ev, /utilities, /faq
├── data/
│   ├── vehicles.json   # ~70 EV/PHEV models incl. cargo vans (capability + source per vehicle)
│   ├── ice_vehicles.json # ~75 gas vehicles people own today (mpg, insurance, maintenance, capability)
│   ├── utilities.yaml  # AEP, Mon Power, Potomac Edison, Wheeling Power, co-ops
│   ├── federal.yaml    # Federal credits, WV state fees, gas & DCFC price baselines
│   ├── ownership.yaml  # WV sales tax, resale retention, depreciation (planner)
│   └── charging_corridors.yaml, charger-snapshot.json
├── public/             # Static assets (old index.html is dormant — Next.js routes /)
├── scripts/
│   └── bootstrap.sh    # Droplet provisioner (one-shot, runs on fresh Ubuntu)
├── Caddyfile           # Reverse proxy to app:3000 + TLS + security headers
├── docker-compose.yml  # caddy + app services
├── Dockerfile          # Multi-stage, Next.js standalone output, non-root runtime
├── next.config.mjs     # output: "standalone"
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── README.md
└── CLAUDE.md           # (this file)
```

## Commands

```bash
# Local development
npm install
npm run dev            # http://localhost:3000
npm run typecheck      # tsc --noEmit
npm run build          # production build
npm run lint

# Deploy: pushing to `main` triggers `.github/workflows/deploy.yml`, which
# SSHes into the droplet and runs the sequence below. No manual step needed.
# Runs take ~60s; watch them at https://github.com/pbrennan10-stack/goevwv/actions.

# Manual fallback (if Actions is down or you need to debug on the droplet):
ssh root@174.138.53.28
cd /opt/goevwv
git fetch origin && git reset --hard origin/main
docker compose up -d --build
docker compose ps
docker compose logs app --tail 50 -f
```

## Calculation methodology (important — document in UI if you change)

- **Winter derate:** +12% annual kWh (4 cold months × ~28% range loss, averaged). Toggleable in UI; default ON.
- **Conservative EPA ratings:** when ≥2 independent tests agree a model beats EPA (Mercedes EQE/EQS/CLA as of Sept 2026), `real_world_range_factor` holds the lowest matching tested/EPA ratio and `winter_range_mi` + efficiency fields in `vehicles.json` are pre-scaled by it (notes record the before values). Highway range is not scaled. Don't apply without test evidence.
- **TOU rate:** 100% off-peak rate assumed — users who opt into TOU are committed to overnight charging. Any monthly charge on the EV meter (`tou_monthly_meter_charge`) is added to annual energy cost. For AEP/Wheeling Schedule PEV it is $0 — the EV submeter sits behind the house meter with no monthly fee (owner-confirmed Sept 2026; an earlier refresh wrongly used $14.02).
- **PHEV split:** commute-aware, assuming nightly charging — each commute day uses min(round trip, electric range) electric miles, each long trip gets one battery's worth; winter derate shrinks electric range by the same 1.12 factor. (Replaced a fixed 65/35 split in Sept 2026.)
- **Grid CO₂ factor:** 0.44 kg/kWh — EPA eGRID RFCW subregion incl. grid losses (WV is in PJM). EIA's WV in-state rate (0.87) is shown as a coal-only worst case.
- **EV insurance:** class base × (0.40 + 0.60 × MSRP / class reference MSRP), clamped 0.85–1.8, × 1.25 for Tesla/Rivian/Lucid/Polestar. Gas-vehicle insurance is per-model in `ice_vehicles.json`.
- **Federal credits:** IRC 30D/25E ended for vehicles acquired after 2025-09-30 and 30C (home charger) after 2026-06-30 (P.L. 119-21). `federalCredit()` returns 0 while `new_ev_credit.active: false`.
- **WV annual fee:** $200 BEV / $100 PHEV added to annual operating cost (per WV Code §17A-10-3c).
- **Results are running costs**, not full ownership cost — purchase price, financing, and resale are not included (the UI says so).

These constants live in `lib/calc.ts`. If you adjust any, also update the "Assumptions" section in `components/Calculator.tsx` so users see what changed.

## Data conventions

- Per-field confidence (Verified / Approximate / Pending) and source provenance is documented at `/state-of-the-data`. That page is the source of truth for "where does this number come from?" — keep it updated when data files change.
- Vehicle MSRPs are MY2025 base-trim approximations. Refresh quarterly.
- Rebate `expires` dates change on utility schedules; verify against the utility's own program page, not aggregators.
- Vehicle `id`s are stable keys used in shareable URLs — never rename one, even when the model year changes. Use `status` (`current` / `final_year` / `discontinued`) instead of deleting a model.
- When editing vehicle `notes`, append to the existing commentary rather than replacing it.
- The gas-price default lives in `federal.yaml` (`gas_price_baseline_per_gal`); the calculator and report read it from there.
- When adding a new rebate that isn't fully confirmed, mark it with `confidence: "approximate"` in the YAML (free-form; not yet schema-enforced) and document the verification gap on `/state-of-the-data` — don't ship it silently.

## Deployment workflow

Auto-deploy via GitHub Actions: every push to `main` triggers `.github/workflows/deploy.yml`, which SSHes into the droplet, runs `git fetch origin && git reset --hard origin/main`, and rebuilds the containers. Typical cycle is ~60 seconds from push to live. The workflow uses the `DEPLOY_KEY` GitHub secret (SSH private key) for droplet access. If the build fails, the previous container keeps running.

Manual fallback — use when Actions is down, the workflow errors, or you're debugging on the droplet directly: `ssh root@174.138.53.28 && cd /opt/goevwv && git fetch origin && git reset --hard origin/main && docker compose up -d --build`.

The first-time droplet setup is in `docs/REBUILD_RUNBOOK.md`. The bootstrap script `scripts/bootstrap.sh` is idempotent and can be re-run safely.

## Operational notes

- SSL certificates live in the `caddy_data` Docker volume on the droplet. Never delete that volume — it triggers Let's Encrypt rate limits on re-issuance.
- Caddy depends on `app` in docker-compose. If app fails to start, Caddy won't proxy correctly and users will see 502s. Check `docker compose logs app` first.
- The droplet has UFW (22/80/443 only), fail2ban on SSH, and unattended-upgrades for security patches. SSH is key-only, no passwords.
- DO weekly backups are enabled (~$1.20/mo).

## Current status (as of 2026-09-23)

- ✅ Domain registered (GoDaddy), DNS pointing at droplet
- ✅ Droplet provisioned (Ubuntu 24.04, Docker, Caddy, firewall, fail2ban)
- ✅ Site live at https://goevwv.com: calculator, charger map (v1.1), About, State of the Data, printable report
- ✅ GitHub Actions auto-deploy on push to `main` is active
- ✅ September 2026 data refresh (utilities, fees, gas, DCFC, vehicle catalog, insurance/maintenance) and Next.js 15 security upgrade

## Open TODOs

- [ ] Clean up whyweare50th.com DNS (retiring domain; A record still points here)
- [ ] Set up UptimeRobot (free, 5-min ping to https://goevwv.com)
- [x] v1.1: charger map using OpenChargeMap API (free key required) — live fetch + committed snapshot fallback
- [x] Household planner at /plan (Sept 2026): multiple vehicles/drivers/trips, auto-assignment with override, trip fit (seats, luggage, towing, charging stops), purchase price + WV sales tax + resale over an ownership period
- [ ] Planner: compare against buying a new GAS vehicle (needs MSRPs in ice_vehicles.json); financing (APR reference in ownership.yaml); fold /calculator into /plan once it covers route/elevation inputs
- [ ] Road trips modeled separately at interstate speed; utility lookup by address; contact/feedback link
- [ ] Move the repo out of OneDrive (or pin it "Always keep on this device") — OneDrive turned .git files into online-only placeholders in Sept 2026 and broke commits
- [ ] v1.1: dealer/installer directory — curated YAML + map overlay
- [x] v1.2: rebate & TOU explainer page — dedicated route per utility (/utilities/[id], Sept 2026)
- [ ] v1.2: optional Decap CMS admin at /admin for YAML-averse editing
- [ ] v2.0: business-mode toggle + fleet TCO (multi-vehicle input, depot charging, commercial tariff, Section 179/bonus depreciation)
- [x] Favicons, OG images, sitemap.xml, robots.txt
- [x] `VERIFY_BEFORE_LAUNCH` markers cleaned up (v1.0.6); per-field confidence now lives on `/state-of-the-data`

## Guide pages (SEO)

`/ev/[id]`, `/utilities/[id]`, and `/faq` are statically generated from `data/*` at build time, so they refresh automatically with every data update — no copy to maintain. They show one "typical WV driver" example (`lib/scenario.ts`: 30 mi/day, 5 days/wk, 4 long trips, 25 mpg, AEP) and deep-link into the calculator with the same inputs; keep `TYPICAL` in step with `DEFAULT_INPUT` in `components/Calculator.tsx`. New vehicles and utilities get pages and sitemap entries automatically. Co-ops are excluded from `/utilities/[id]` because their rates are unverified.

## Household planner (/plan)

Engine in `lib/household.ts` reuses `lib/calc.ts` energy/DCFC/insurance helpers — change per-mile math there, not in the planner. Total over N years = running costs × N + lost value (new vehicle: price + WV 6% sales tax after trade-in + title − resale via `retention_5yr` or the user's slider; kept vehicles: `older_vehicle_annual_depreciation`). The sold vehicle's would-be depreciation stays in the "today" scenario, which keeps the comparison fair. Each use goes to the cheapest vehicle whose `fit()` isn't "no". `scripts/smoke-household.ts` is a quick sanity run (see its header).

## Principles

- **Honest numbers over marketing copy.** Assumptions are shown, not hidden.
- **Minimum surface area.** No auth, no tracking of personal data, no email collection unless a user explicitly opts in to alerts (not v1).
- **Boring infra.** Choose the dependency with the smallest footprint that works.
- **Mobile-first.** Most WV drivers will hit the site on a phone.
- **Content changes via git commits** to `data/*`, not admin pages. One source of truth.
- **Show your work.** Every calculated result has a "why" expandable or footnote.

## How Patrick works

- Not a developer. Comfortable with step-by-step instructions, SSH, and DNS now. Prefers plain-English explanations over jargon.
- Reviews changes in GitHub or VS Code, then commits. Doesn't want to hand-edit terminal paste if it can be scripted.
- Wants the site to require ~1 hour of maintenance per month once launched.
- Will tell you if something breaks the forum droplet — but note, that droplet was wiped; no Discourse remains.

## If something breaks in production

1. `ssh root@174.138.53.28`
2. `cd /opt/goevwv && docker compose logs --tail 100` → find the failing container
3. If app crashes: `docker compose logs app` for Next.js runtime errors
4. If TLS issues: `docker compose logs caddy` — Let's Encrypt rate limits show up here
5. Quick rollback: `git reset --hard HEAD~1 && docker compose up -d --build`
6. Nuclear rollback: restore the most recent DO snapshot from the DigitalOcean dashboard

## Things NOT to do

- Don't add `npm` packages casually — each dependency is long-term maintenance. Justify in the PR/commit.
- Don't store any secrets in the repo or env files committed to git. The site has no secrets currently and should stay that way through v1.
- Don't introduce a database for v1. SQLite is fine later for things like usage counters; defer until needed.
- Don't run `docker system prune -a` on the droplet — it deletes the `caddy_data` volume and forces Let's Encrypt re-issuance.
- Don't commit `.env.*`, `node_modules/`, `.next/`, or database files. `.gitignore` handles this but double-check.
