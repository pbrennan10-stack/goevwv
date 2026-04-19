# GoEV WV — Context for Claude Code

**Live site:** https://goevwv.com
**Repo:** https://github.com/pbrennan10-stack/goevwv
**Owner:** Patrick Brennan (pbrennan10@gmail.com)
**Droplet:** 174.138.53.28 (DigitalOcean, Ubuntu 24.04 LTS)

## What this project is

A West Virginia-specific EV advisor. Users enter commute + utility + current vehicle and see honest TCO numbers for 1–3 EVs/PHEVs, factoring in WV utility rates, cold-winter range derating, the WV $200 annual EV fee, TOU rates where available, and federal IRA credits. No user accounts, no tracking beyond basic analytics; all calculations are client-side.

Audience is both residential drivers and (by v2) WV small-business fleets.

## Stack

- **Next.js 14** App Router + TypeScript + Tailwind
- **Node.js 20** (Alpine in Docker)
- **Data files** under `data/` — curated JSON/YAML, edited via git commits (no CMS yet)
- **Docker + Caddy** — Caddy handles TLS via Let's Encrypt automatically
- **SQLite** (planned, not yet used — v1 is fully static/stateless)
- **Mapbox** (planned, not yet wired) — for geocoding and routing in v1.1

Intentional non-choices: no Postgres, Redis, auth, email, or background workers. Keep the infra boring.

## Required env vars (build-time)

- **`NEXT_PUBLIC_MAPBOX_TOKEN`** — Mapbox token for RouteHelper (geocoding/directions) and ChargerMap rendering. Embedded in the client bundle at build.
- **`OPENCHARGEMAP_API_KEY`** — Free key from openchargemap.org. Used server-side at build time to fetch the WV charger list for `/chargers`. Without it, the page shows a graceful "temporarily unavailable" fallback instead of the map.

Locally these live in `.env.local` (gitignored). On the droplet they live in `/opt/goevwv/.env`, read by `docker compose` and forwarded as build-args per `docker-compose.yml`.

## Repo layout

```
goevwv/
├── app/                # Next.js App Router
│   ├── layout.tsx      # Root layout, metadata, viewport
│   ├── page.tsx        # Landing + calculator (server component loads data)
│   └── globals.css     # Tailwind base
├── components/
│   ├── Calculator.tsx  # Main client component: form + vehicle picker + results
│   └── Logo.tsx
├── lib/
│   ├── types.ts        # TS types for Vehicle, Utility, FederalData, CalcInput, VehicleResult
│   ├── data.ts         # Server-only: loads data/*.json and data/*.yaml
│   └── calc.ts         # TCO math + number formatters
├── data/
│   ├── vehicles.json   # ~20 EV/PHEV models curated for WV
│   ├── utilities.yaml  # AEP, Mon Power, Wheeling Power, rural coops
│   └── federal.yaml    # IRA credits, WV state fees, gas-price baseline
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

# Deploy to droplet (ssh root@174.138.53.28 first)
cd /opt/goevwv
git pull
docker compose up -d --build
docker compose ps
docker compose logs app --tail 50 -f
```

## Calculation methodology (important — document in UI if you change)

- **Winter derate:** +12% annual kWh (4 cold months × ~28% range loss, averaged). Toggleable in UI; default ON.
- **TOU rate:** 100% off-peak rate assumed — users who opt into TOU are committed to overnight charging.
- **PHEV split:** 65% electric miles / 35% gas miles (Argonne/INL fleet data).
- **WV grid CO₂ factor:** 0.67 kg/kWh (EIA state profile; WV is heavily coal-fired).
- **Federal $7,500 IRA credit:** applied when `vehicle.tax_credit_eligible = true` AND MSRP ≤ $55k (cars) / $80k (SUVs/trucks). Assumes point-of-sale claim.
- **WV annual fee:** $200 BEV / $100 PHEV added to annual operating cost (per WV Code §17A-10-3c).

These constants live in `lib/calc.ts`. If you adjust any, also update the "Assumptions" section in `components/Calculator.tsx` so users see what changed.

## Data conventions

- Per-field confidence (Verified / Approximate / Pending) and source provenance is documented at `/state-of-the-data`. That page is the source of truth for "where does this number come from?" — keep it updated when data files change.
- Vehicle MSRPs are MY2025 base-trim approximations. Refresh quarterly.
- Rebate `expires` dates change on utility schedules; verify against the utility's own program page, not aggregators.
- When adding a new rebate that isn't fully confirmed, mark it with `confidence: "approximate"` in the YAML (free-form; not yet schema-enforced) and document the verification gap on `/state-of-the-data` — don't ship it silently.

## Deployment workflow

Current (manual): edit files → commit → push → SSH into droplet → `git pull && docker compose up -d --build`.

**TODO:** Set up GitHub Actions to auto-deploy on push to `main`. This is tracked in Open TODOs below. Until then, pushing does NOT deploy automatically.

The first-time droplet setup is in `docs/REBUILD_RUNBOOK.md` (parent folder in Cowork workspace, also should be copied into `docs/` here). The bootstrap script `scripts/bootstrap.sh` is idempotent and can be re-run safely.

## Operational notes

- SSL certificates live in the `caddy_data` Docker volume on the droplet. Never delete that volume — it triggers Let's Encrypt rate limits on re-issuance.
- Caddy depends on `app` in docker-compose. If app fails to start, Caddy won't proxy correctly and users will see 502s. Check `docker compose logs app` first.
- The droplet has UFW (22/80/443 only), fail2ban on SSH, and unattended-upgrades for security patches. SSH is key-only, no passwords.
- DO weekly backups are enabled (~$1.20/mo).

## Current status (as of 2026-04-18)

- ✅ Domain registered (GoDaddy), DNS pointing at droplet
- ✅ Droplet provisioned (Ubuntu 24.04, Docker, Caddy, firewall, fail2ban)
- ✅ Coming Soon page deployed (static, served by Caddy)
- ✅ MVP code complete locally (this commit if you're reading it post-push)
- 🟡 **MVP not yet deployed to the droplet** — needs `git pull && docker compose up -d --build` on droplet after push

## Open TODOs

- [ ] **Push MVP to GitHub + `git pull + docker compose up -d --build` on droplet**
- [ ] Clean up whyweare50th.com DNS (retiring domain; A record still points here)
- [ ] Set up UptimeRobot (free, 5-min ping to https://goevwv.com)
- [ ] Add GitHub Actions auto-deploy on push to main (webhook to droplet, or polling)
- [ ] v1.1: charger map using OpenChargeMap API (free, no key) — map UI + cache layer
- [ ] v1.1: dealer/installer directory — curated YAML + map overlay
- [ ] v1.2: rebate & TOU explainer page — dedicated route per utility
- [ ] v1.2: optional Decap CMS admin at /admin for YAML-averse editing
- [ ] v2.0: business-mode toggle + fleet TCO (multi-vehicle input, depot charging, commercial tariff, Section 179/bonus depreciation)
- [ ] Eventually: favicons, OG images, sitemap.xml, robots.txt
- [x] `VERIFY_BEFORE_LAUNCH` markers cleaned up (v1.0.6); per-field confidence now lives on `/state-of-the-data`

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
