# GoEV WV — Implementation Plan

**Status:** v1.0 MVP code complete locally, not yet deployed to droplet.
**Last updated:** 2026-04-18
**Owner:** Patrick Brennan
**See also:** [`/CLAUDE.md`](../CLAUDE.md) for operational context, [`/docs/REBUILD_RUNBOOK.md`](./REBUILD_RUNBOOK.md) for first-time droplet setup.

---

## 1. Executive summary

A West Virginia-specific EV advisor. Users enter commute + utility + current vehicle and see honest TCO for up to 3 EVs/PHEVs. Factors in WV utility rates, cold-winter range derating, the $200 annual EV fee, TOU rates where available, and federal IRA credits.

Residential v1 ships first; business fleet mode arrives in v2.0.

The site is designed around a low-maintenance operating model: content updates are YAML/JSON edits committed to git. No CMS in v1.

---

## 2. Goals

1. Give a WV resident an honest EV ownership cost estimate vs. their current vehicle within 90 seconds of landing.
2. By v2.0: let a WV small-business owner model a 1–10 vehicle fleet transition with realistic assumptions for their utility and location.
3. Surface local, actionable next steps (v1.1+): dealers, installers, chargers, current rebates.
4. Operating cost under $15/month.
5. ≤1 hour/month of owner maintenance once stable.

**Non-goals (v1):** no accounts, no real-time dealer inventory, no mobile app, no on-site transactions.

---

## 3. Status at a glance

| Phase | Status |
|---|---|
| Domain registered (goevwv.com @ GoDaddy) | ✅ Done |
| Droplet rebuilt to Ubuntu 24.04 LTS | ✅ Done |
| Bootstrap: Docker, UFW, fail2ban, unattended-upgrades, Caddy | ✅ Done |
| SSH hardened (key-only) | ✅ Done |
| DNS pointing at droplet, TLS via Caddy+Let's Encrypt | ✅ Done |
| Coming Soon page live | ✅ Done |
| **v1.0 MVP code (Next.js calculator)** | 🟡 **Complete locally, not yet pushed/deployed** |
| Pre-owned domain (whyweare50th.com) DNS cleanup | ⚠️ Pending |
| UptimeRobot monitoring | ⚠️ Pending |
| GitHub Actions auto-deploy | ⚠️ Pending |
| v1.1 (charger map + dealer directory) | 🔜 Next |
| v1.2 (rebate/TOU explainer) | 🔜 |
| v2.0 (business fleet mode) | 🔜 |

---

## 4. Tech architecture

**Stack:**
- Next.js 14 (App Router) + TypeScript + Tailwind
- Node.js 20 (Alpine) in Docker, standalone output
- Caddy 2 reverse proxy, auto Let's Encrypt
- Data: curated JSON + YAML in `data/`, loaded at build time via server components
- SQLite planned for later (usage counters, cached charger data); not used in v1.0

**Why this stack:** one language (TypeScript) front-to-back; zero DB admin for v1; Caddy removes SSL pain forever; Docker makes redeploys idempotent.

**Repo layout** is documented in [`/CLAUDE.md`](../CLAUDE.md).

**Third-party APIs (planned, not in v1.0):**
- Mapbox — geocoding, routing, map tiles (free tier: 50k map loads/mo)
- OpenChargeMap — public charger data (free)
- DSIRE — rebate reference (free)
- NHTSA vPIC — vehicle spec lookup (free)

---

## 5. Feature roadmap

### v1.0 — Core calculator (shipping now)

- Residential-only
- Inputs: daily round-trip miles, days/week, utility, current MPG, gas price, winter derate toggle, TOU toggle
- Vehicle picker (up to 3 from 20-model catalog)
- Per-vehicle results card: annual savings vs current car, 5-year savings, annual energy cost, WV state fee, CO₂ avoided, federal credit, effective price
- Warnings for range-anxiety cases (daily miles approaching EPA range, etc.)
- Collapsible "Assumptions" section documenting every constant
- URL state sync for shareable results

### v1.1 — Charger map + dealer/installer directory

- OpenChargeMap pull, cached daily in SQLite, filtered to WV bounding box
- Interactive map (Mapbox GL JS) with connector/speed filters
- Curated dealer/installer YAML, map overlay + list view
- Route-proximity filter ("chargers within 10 mi of my commute")

### v1.2 — Rebates, TOU, and CMS

- Per-utility rebate page (plain language + current program list)
- TOU vs flat-rate break-even calculator
- Federal IRA tax-credit eligibility walkthrough (new vs used, point-of-sale vs return)
- Optional Decap CMS at `/admin` (git-backed, free) for YAML-averse editing

### v2.0 — Business / fleet mode

- Top-of-page Residential / Business toggle
- Multi-vehicle fleet input
- Depot charging sizing (kW per vehicle × fleet size)
- Commercial tariff + demand-charge modeling
- Section 179 / bonus depreciation stack
- Printable PDF TCO report

---

## 6. Deployment workflow

### Current (manual)

1. Edit files locally
2. Commit + push to `github.com/pbrennan10-stack/goevwv`
3. SSH to droplet: `ssh root@174.138.53.28`
4. `cd /opt/goevwv && git pull && docker compose up -d --build`
5. `docker compose ps` to verify

### Target (post v1.0 ship)

GitHub Actions workflow triggered on push to `main`:
1. Build & typecheck in CI
2. SSH deploy to droplet (using a GH Actions deploy key)
3. Run `git pull && docker compose up -d --build`

The build-side work for this is small; the main cost is provisioning a second SSH key for GH Actions and adding it to the droplet's `authorized_keys`.

---

## 7. Data management

**Three curated files** under `data/`:

- `vehicles.json` — ~20 EV/PHEV models, curated for WV market
- `utilities.yaml` — AEP, Mon Power, Wheeling Power, rural coop fallback
- `federal.yaml` — IRA credits, WV state fees, grid emissions factor, gas baseline

**Update cadence:**

| Data type | How often | Who updates |
|---|---|---|
| Vehicle MSRPs | 1–2×/year per model | Owner, manually |
| Utility flat rates | 1–2×/year | Owner, from PSC filings |
| Utility rebates | 2–4×/year | Owner, from utility sites |
| Federal credits | 1×/year or on legislation | Owner, from IRS |
| Public chargers (v1.1+) | Continuous | Auto, via OpenChargeMap |

All updates = `git commit` → push → redeploy. A "Data last updated X days ago" badge will appear in the footer so freshness is visible.

---

## 8. Budget

| Item | Monthly |
|---|---|
| DigitalOcean Basic Droplet | $6.00 |
| DO weekly backups | $1.20 |
| Domain (goevwv.com, amortized $12/yr) | $1.00 |
| Mapbox | Free tier |
| OpenChargeMap | Free |
| GitHub (public repo) | Free |
| UptimeRobot (free tier) | Free |
| **Total** | **~$8.20/mo** |

Headroom within the $15/mo cap for a future Plausible Analytics upgrade, email service (if account alerts added), or droplet resize.

---

## 9. Handoff to Claude Code

The project was initially set up in **Cowork mode** (droplet provisioning, DNS, scaffolding, MVP code). Going forward, **Claude Code** is the better fit because the work is now iterative coding + git operations.

### To switch over:

**Step 1 — Install tooling on your laptop:**

1. **VS Code:** https://code.visualstudio.com (free)
2. **Git for Windows:** https://git-scm.com/download/win (during install, accept defaults; "Use Visual Studio Code as Git's default editor" is a nice option)
3. **Claude Code:** follow the current install instructions at https://docs.claude.com (search "Claude Code install"). Typically one command in PowerShell.

**Step 2 — One-time git setup:**

In PowerShell:
```
git config --global user.name "Patrick Brennan"
git config --global user.email "pbrennan10@gmail.com"
```

**Step 3 — Clone the repo to a working location:**

Pick a location for your working copy. Suggestion: `C:\dev\goevwv`. Then:
```
mkdir C:\dev
cd C:\dev
git clone https://github.com/pbrennan10-stack/goevwv.git
cd goevwv
```

First time cloning to a fresh machine, GitHub may prompt you to authenticate. Follow the Git Credential Manager dialog — easiest is "Sign in with browser."

**Step 4 — Open in VS Code + launch Claude Code:**

```
code .
```
(opens VS Code in the current folder)

Then open VS Code's terminal (Ctrl+`) and run:
```
claude
```

Claude Code starts and reads `CLAUDE.md` automatically. It now has full project context.

**Step 5 — Finish the MVP deploy through Claude Code:**

Once Claude Code is running, tell it:

> I'm picking up from a Cowork session. The MVP code is already in the repo but not yet pushed. Please verify git status, push any uncommitted changes, then SSH to 174.138.53.28 and run `cd /opt/goevwv && git pull && docker compose up -d --build` to deploy.

Claude Code will walk you through commits, pushing, and the droplet deploy directly from your terminal.

### What Cowork produced that you should keep handy

All in `D:\Documents\Claude\Projects\GOEVWV\` (Cowork workspace folder):

- `IMPLEMENTATION_PLAN.md` — full plan (superseded by this file)
- `REBUILD_RUNBOOK.md` — first-time droplet setup steps (one-shot; unlikely needed again)

Copies of both were placed into the repo under `docs/` for reference.

---

## 10. Open questions / future decisions

- Analytics: free GA4 vs. self-hosted Plausible ($0 vs $9/mo)?
- Email collection for rebate alerts? (Would add email service cost.)
- Should the site support Spanish at some point? (WV has small but real non-English-speaking populations.)
- Used-EV focus page — important for WV affordability, not in the v1 roadmap yet.

---

## 11. Risks

- **Stale rate/rebate data** — Mitigation: quarterly review calendar reminder + visible "data last updated" badge.
- **Financial-advice liability** — Mitigation: clear disclaimer in footer and results card; every number has a shown assumption.
- **Mapbox free-tier blow-out** (v1.1+) — Mitigation: server-side caching of geocoding, budget alerts, auto-fallback to Leaflet+OSM.
- **Droplet compromise** — Mitigation: UFW, key-only SSH, fail2ban, unattended-upgrades, weekly backups, minimal attack surface.
- **Claude Code vs Cowork context drift** — Mitigation: `CLAUDE.md` in the repo is the single source of truth on project conventions.

