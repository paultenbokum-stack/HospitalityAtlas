# Atlas CRM

A simple shared sales CRM for small teams: prospect lists, activity logging with next steps, a pipeline
board, configurable classification attributes, and structured "why we lost" reasons. Google Maps discovery
feeds new prospects in. Multi-tenant: each business gets its own workspace and vocabulary.

Split out of `GuestWaveSalesEngine`; the original vanilla-JS Hospitality Atlas is kept in `legacy/`.

## Quick start
```bash
docker compose up -d postgres
cp .env.example .env.local        # set AUTH_SECRET
npm install
npm run db:migrate && npm run db:seed
npm run dev                        # http://localhost:3000 → sign in as admin@dev.local
```

## Docs
- [CLAUDE.md](CLAUDE.md) — hard rules (no personal data, workspace scoping, Places ToS)
- [docs/DECISIONS.md](docs/DECISIONS.md) — how it behaves and why (binding)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — stack and data model
- [docs/PLAN.md](docs/PLAN.md) — milestones and non-goals
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — GCP setup (own project, shared billing account) and CI/CD
