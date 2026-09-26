# Handoff — state as of 2026-09-25

Read this first when picking the project up in a new session/account. Binding rules are in `CLAUDE.md`
and `docs/DECISIONS.md`; this file is the working state and the to-do list.

## Where things are
- **Repo:** `C:\wamp64\www\HospitalityAtlas` → `github.com/paultenbokum-stack/HospitalityAtlas` (private), branch `main`.
  Last pushed commit: `a6b97d4 feat: rebuild Hospitality Atlas as a multi-tenant sales CRM`.
- **Origin:** split from partner repo `saffykyle-blip/GuestWaveSalesEngine@c88add5` (folder `Hospitality_Atlas/`
  + `guestwave-sales-engine/src/app/admin/atlas`). Old vanilla app lives in `legacy/` (reference only).
- **Sibling project:** GuestWave at `C:\wamp64\www\guestwave` — same stack; conventions were copied from it
  (db client, auth pattern, Dockerfile, deploy workflow). Not a shared package.

## Status
M0–M4 built and verified in the browser locally (see `docs/PLAN.md`). 19 tests pass incl. the cross-workspace
isolation test. **Not yet verified:** Discover against a real Places key; Google SSO with a real OAuth client;
the GitHub Actions run for `a6b97d4` (check the repo's Actions tab — `gh` CLI isn't installed on this machine).

## Run it locally
1. Start **Docker Desktop** (`%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe`) — it can take several
   minutes and sometimes waits on a prompt in its window.
2. `docker compose up -d postgres` → Postgres 16 on **localhost:5433** (db/user `atlas`, pw `atlas_dev`).
   Note: a separate native Postgres 16 (GuestWave's) owns port 5432 — don't confuse them.
3. `.env.local` exists (gitignored) with `DATABASE_URL`, `AUTH_SECRET`, `DEV_LOGIN=1`, `SEED_DEV=1`.
   Template: `.env.example`. Google/Places keys are empty.
4. `npm run db:migrate && npm run db:seed` (already done once — data persists in the docker volume).
5. `npm run dev -- -p 3100` (preview config: this repo's `.claude/launch.json` → `atlas-crm-dev`; GuestWave's
   `.claude/launch.json` has an uncommitted duplicate entry that can be reverted).
6. Sign in at `/login` with the dev form: `admin@dev.local` (superadmin), `rep@dev.local` (GuestWave rep),
   `security-rep@dev.local` (only in "Security SaaS (demo)").
7. Tests: `npm test`; the tenancy test needs `TEST_DATABASE_URL=postgresql://atlas:atlas_dev@localhost:5433/atlas_test`
   (that database exists and is migrated; re-run `drizzle-kit migrate` against it after schema changes).

Local sample data: GuestWave workspace has "Salt Café" (Lost / Has a competitor, POS Pilot) and "Zimbali Lodge";
a "Toast" POS option was added in Settings. All disposable.

## Gotchas learned
- **Raw `sql` fragments:** don't interpolate a JS `Date` — postgres.js throws. Use `${d.toISOString()}::timestamptz`
  (see `logActivity` in `src/lib/repo/timeline.ts`). Column-typed helpers (`eq`, `gte`, `.set({...})`) are fine.
- **`"use server"` files:** every export is a public endpoint. Keep read helpers in `src/lib/repo/*`, never in
  `src/lib/actions/*` (a `listViews` leak was caught and moved to `repo/views.ts`).
- `server-only` is aliased to its empty build in `vitest.config.mts`; seed runs with `tsx --conditions=react-server`.
- `npm i` of vitest needs `@types/node@^22` (peer conflict with ^20).
- Next 16: `params`, `searchParams`, `cookies()` are async.
- The in-app browser's accessibility snapshot (`find`) can lag after `router.refresh()`; check with page text.

## Next steps (suggested order)
1. **Confirm CI is green** for `a6b97d4` on GitHub Actions; fix if not.
2. **Try Discover** with a real key: set `GOOGLE_PLACES_API_KEY` (server, Places API (New) only) and optionally
   `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` in `.env.local`; quick-scan Ballito, add 3, re-scan shows "In CRM".
   Watch cost: each scan = search terms × tiles (quick 8, deep 72 requests with the hospitality template).
3. **Decide:** when a company moves to Lost, auto-close its open next steps? (Currently they stay open.)
   Record the answer in `docs/DECISIONS.md`.
4. **GCP setup** per `docs/DEPLOYMENT.md` — new project on the same billing account, `africa-south1`, then set
   GitHub secrets and repo variable `DEPLOY_ENABLED=true`. Real Google OAuth client needed for sign-in.
5. **M5 legacy import** — place ids + contacted flag only from the old Atlas JSON export; never notes (PII).
6. Daily task-digest email (Resend, pattern from GuestWave `src/lib/email.ts`).
7. Delete `legacy/` once nothing references it.
8. Later / flag before building: deals (multiple per company), email/calendar sync. Named contacts need the
   organisation's admin sign-off (POPIA) — out of scope until then.

## Loose ends outside this repo
- **Partner repo** `GuestWaveSalesEngine` still contains `Hospitality_Atlas/`, `/admin/atlas` and its nav link —
  ask the owner (saffykyle-blip) to remove them. It also has **committed live secrets** (a Firebase admin SDK
  JSON and `env.yaml`) that must be **rotated** (they're in git history). Don't copy anything from it.
- **GuestWave** repo: `.claude/launch.json` has an uncommitted `atlas-crm-dev` entry — commit or revert.
- The developer integration guide `.docx` in `legacy/` was never reviewed for keys/PII — skim before sharing.

## Standing rules to carry over (from the organisation / owner)
- Organisation policy: **do not allow personally identifiable data to be imported or interrogated.** This is why
  the CRM is business-level only (see `CLAUDE.md`). Don't read stored prospect data or the old Atlas localStorage.
- Always write the company name **YUMBI** in capitals.
- Don't commit or push without the owner's explicit go-ahead; one clean commit per change, then push.
- Build UI from design mockups where they exist (GuestWave rule); this CRM has none yet — its UI is a neutral
  Tailwind design using the tokens in `src/app/globals.css`.
