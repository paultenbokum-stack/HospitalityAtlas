# Atlas CRM

Small, multi-tenant sales CRM: a few staff work prospect lists, log sales activity, classify companies and
record why deals are lost. Google Maps discovery feeds new prospects in; it is not the management UI.
First tenant: GuestWave (hospitality). Designed so an unrelated business (e.g. a security SaaS) can run its
own workspace with its own stages, reasons and attributes.

## Read these before making decisions
- `docs/DECISIONS.md` — **binding** behaviour and data rules. Append new decisions in the same change.
- `docs/ARCHITECTURE.md` — stack, data model, tenancy
- `docs/PLAN.md` — scope, milestones, non-goals
- `docs/DEPLOYMENT.md` — GCP (own project, shared billing account), CI/CD

## Stack
Next.js 16 (App Router) + TypeScript, Tailwind v4, PostgreSQL + Drizzle (postgres.js), Auth.js v5 (Google SSO),
zod, uuidv7, Vitest. Mirrors GuestWave's conventions (`C:\wamp64\www\guestwave`). Next 16 has breaking
changes (async `params`/`searchParams`/`cookies()`); check `node_modules/next/dist/docs/` when unsure.

## Hard rules
- **Business-level data only.** Org policy: no personally identifiable data imported or interrogated. No
  named contacts, personal emails or mobile numbers. Contacts are *roles* ("Owner", "GM"). Free text goes
  through `src/lib/pii.ts`. Staff identity (Google email/name) is the only personal data held.
- **Every tenant query filters by `workspace_id`.** Repo functions in `src/lib/repo/*` take `workspaceId` first.
  Server actions get it from `requireRole()` (`src/lib/session.ts`), never from client input.
- **Never export a non-action helper from a `"use server"` file.** Every export there is a public endpoint.
- **Google Places ToS:** persist only `place_id` (`companies.external_ref`). Ratings, hours, phone etc. are shown
  live and never stored. Places calls are server-side (`src/lib/places.ts`) with a server key.
- Vocabulary (stages, reasons, activity types, attributes) is per-workspace data — never hardcode it.
  Attribute select values are stored as option **ids**, never labels.
- IDs are uuidv7. Zod at every boundary. Server actions return `Result` via `run()` (`src/lib/actions/result.ts`).

## Commands
- `docker compose up -d postgres` — local DB on port 5433
- `npm run db:migrate` / `npm run db:generate` / `npm run db:seed` / `npm run db:studio`
- `npm run dev` · `npm test` (set `TEST_DATABASE_URL` to run the tenancy integration test) · `npm run lint`

## Layout
- `src/db/schema.ts` — all tables; `src/db/seed.ts` — idempotent seed
- `src/lib/repo/` — scoped queries · `src/lib/actions/` — server actions · `src/lib/templates.ts` — workspace templates
- `src/app/(crm)/` — signed-in screens · `legacy/` — the old vanilla Atlas app (reference only; delete once unneeded)
