# GoEV WV

**Live site:** https://goevwv.com (not yet deployed)
**Repo:** https://github.com/pbrennan10-stack/goevwv

An interactive advisor for West Virginians considering an electric vehicle. Enter your commute, pick vehicles to compare, and see honest, WV-specific numbers on cost, payback, and charging feasibility.

## Why

West Virginia's EV calculus is different from California's. We have different utility rates, different rebates, cold winters that sap range, rural geographies, different dealer networks, and a state-level annual EV fee. Generic EV calculators miss all of that. This site exists to give West Virginians a fair and local answer.

## Stack

- Next.js 14 (App Router) on Node.js
- SQLite via `better-sqlite3`
- Docker + Docker Compose
- Caddy reverse proxy (automatic SSL)
- Mapbox (maps, geocoding, routing — free tier)
- OpenChargeMap (public charger data)

## How this repo is organized

```
goevwv/
├── data/               # Curated content — edit these to update the live site
│   ├── utilities.yaml  # WV utility rates, rebates, TOU programs
│   ├── vehicles.json   # EV/PHEV catalog with specs
│   └── federal.yaml    # Federal tax credits and registration fees
├── app/                # Next.js app (UI + API routes)
├── lib/                # Shared business logic (cost calc, route calc, etc.)
├── public/             # Static assets
├── docker-compose.yml  # Production deployment config
├── Dockerfile
└── Caddyfile           # Reverse proxy + SSL config
```

## How to update content (the normal workflow)

1. Open [the repo on GitHub](https://github.com/pbrennan10-stack/goevwv) in your browser
2. Click into `data/` and choose the file you want to edit
3. Click the pencil icon, make your change, click "Commit changes"
4. Wait ~60 seconds — the live site will rebuild and deploy automatically

## Status

v0 content scaffolding — not yet deployed. See `IMPLEMENTATION_PLAN.md` in the parent folder for the full roadmap.
