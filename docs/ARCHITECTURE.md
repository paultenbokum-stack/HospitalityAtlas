# Architecture

## Why PostgreSQL (not localStorage / Firestore)
The legacy Atlas kept everything in the browser's localStorage (the sales engine's *orders* used Firestore).
CRM data is relational — companies ↔ activities ↔ tasks ↔ users ↔ per-workspace vocabulary — and needs
tenant scoping, multi-column filters and aggregate reports. Postgres + Drizzle handles all of that and
matches GuestWave's stack and operations.

## Stack
Next.js 16 App Router (server components + server actions), TypeScript, Tailwind v4, Drizzle ORM on
postgres.js, Auth.js v5 (Google, JWT sessions, our own `users` table — no adapter), zod, uuidv7, Vitest.
Deployed as a standalone Next image on Cloud Run with Cloud SQL (unix socket).

## Request flow
- **Pages** (`src/app/(crm)/**/page.tsx`) call `requirePageContext(minRole)` → `{ workspace, role, userId }`, then
  read through `src/lib/repo/*` with `workspace.id`.
- **Mutations** are server actions in `src/lib/actions/*`: `run(async () => { const ctx = await requireRole(); … })`.
  Input is parsed with zod; errors come back as `{ ok: false, error }`.
- **Places** calls go through `src/lib/places.ts` (server-only).

## Data model
| Table | Purpose |
|---|---|
| `workspaces` | Tenant. `settings` jsonb: country, discovery search terms + area presets |
| `users` | Staff (Google email/name), `is_superadmin` |
| `memberships` | user × workspace × role (`admin` / `manager` / `rep`) |
| `invites` | Pending invite by email + role |
| `pipeline_stages` | Ordered stages with kind `open` / `won` / `lost`, colour, active |
| `outcome_reasons` | Why a company was lost |
| `activity_types` | Call / Visit / Email / … |
| `attribute_definitions` | Custom classification fields; select options `{id,label,active}` |
| `companies` | Business record, stage, owner, outcome reason, `attributes` jsonb, `external_ref` (place id), follow-up + last-activity timestamps, `archived_at` |
| `activities` | Timeline: `log` (typed, rep-written) or `system` (auto) |
| `tasks` | Next steps: title, due, assignee, done |
| `saved_views` | Named list filters; `owner_user_id` null = shared |

## Multi-tenancy
Single database, shared schema, `workspace_id` on every tenant row with `ON DELETE CASCADE` from
`workspaces`. Isolation is enforced in the repo layer and covered by `src/lib/repo/tenancy.test.ts`.
A second business gets its own workspace (created from a template) — no code changes.
