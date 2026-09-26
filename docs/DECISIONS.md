+-# Decisions

Binding record of *how it works and why*. Code follows this file; when you infer or agree a decision that
isn't here, add it in the same change. Newest sections at the bottom.

## Product shape *(built)*
- **CRM first, discovery second.** Companies list, company page and pipeline are the working surfaces.
  Discover (Google Places) only feeds new companies in — it replaced the legacy Atlas, where the map *was*
  the product and records lived in browser localStorage.
- **Split from GuestWaveSalesEngine** (`saffykyle-blip/GuestWaveSalesEngine@c88add5`). No secrets and no
  prospect data were carried over. Legacy app kept under `legacy/` for reference only.
- Working name **Atlas CRM**; repo stays `HospitalityAtlas`.

## Data & privacy *(built)*
- **Business-level data only** (org policy: no PII imported or interrogated). Companies store the business
  line, website, a *generic* inbox (info@/bookings@ — personal-looking addresses are rejected) and contact
  **roles** as text (`contact_roles`), never names. Named contacts are out of scope unless the organisation's
  administrator signs off on POPIA handling.
- Free text (activity notes, task titles, company name/address, attribute text) is checked by
  `src/lib/pii.ts`: SA mobile numbers, SA ID numbers and personal-looking emails are **blocked with an
  explanation** (not silently stripped). It can't detect personal names — the UI copy asks reps to use roles.
- Staff users (Google email + name) are the only personal data held — required for sign-in and attribution.
- **Legacy import:** if done, bring across place ids + contacted flag only; **legacy notes are not imported**.

## Google Places *(built)*
- Only `place_id` is persisted (`companies.external_ref`, unique per workspace) — Places ToS forbids storing
  other content. On "Add to CRM" the rep-confirmed business **name, locality and region** are saved as the
  CRM's own record. Rating, reviews, phone, website and hours are fetched live on the company page
  (1h fetch cache) and labelled "not stored".
- All Places calls are server-side with `GOOGLE_PLACES_API_KEY`; the browser only gets a referrer-restricted
  Maps JS key for drawing pins (`NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`, optional).
- Scan = resolve area → viewport; quick = 1 tile, deep = 3×3 tiles; each tile runs every workspace search
  term (≤20 results each), deduped by place id. **Cost ∝ terms × tiles**, so deep is capped at 3×3 and adding
  results never re-scans.
- A scan can be narrowed to **one** configured search term (Discover → "Search for"; default all terms), so
  reps don't pay for types they aren't after. The server only accepts a term that is in the workspace's list.

## Tenancy *(built)*
- **Workspace** = tenant. Everything tenant-owned has `workspace_id`; repo functions take it first; actions
  derive it from the session (`requireRole`) and never trust a client-supplied workspace or bare ids.
- A user can belong to several workspaces; the `crm-workspace` cookie picks the current one. Superadmins see
  all workspaces as admin and can create new ones from a **template** (`src/lib/templates.ts`: hospitality,
  security-saas). Templates are copied once; afterwards everything is edited in Settings.
- Roles: **rep** (work companies, log, own views), **manager** (+ archive, share views), **admin**
  (+ Settings and people).

## Auth *(built)*
- Google SSO only, **invite-only**. Sign-in is accepted for: `ROOT_ADMIN_EMAIL` (bootstraps the first
  superadmin), an existing user, or an email with a pending invite (accepting creates the membership).
- A `dev` credentials provider exists only when `NODE_ENV !== "production"` and `DEV_LOGIN=1`.

## Pipeline & feedback *(built)*
- Stages are per workspace, ordered, with a kind: `open | won | lost`. Default hospitality pipeline:
  New → Contacted → Qualified → Demo/visit → Proposal → Won / Lost / Not a fit.
- **Moving to a lost stage requires an outcome reason** (`stage-rules.ts`); leaving it clears the reason.
  Bulk stage moves can't target lost stages (each lost company needs its own reason).
- Outcome reasons are one flat per-workspace list (the plan's "applies-to" split was dropped as unneeded).
- A stage can only be hidden when no company is in it.

## Attributes (extensible classification) *(built)*
- Per-workspace definitions: `text | number | bool | date | select | multiselect`. Stored in
  `companies.attributes` jsonb (GIN-indexed), validated against the definitions by zod on every write.
- Select options have **stable ids**; values store ids, so relabelling is safe. Options are retired (hidden),
  never deleted — existing values stay readable and reportable.
- Attribute keys are derived from the label at creation and never change.

## Activity & next steps *(built)*
- One timeline per company: logged activities (typed: Call/Visit/Email/Meeting/Note, per workspace) plus
  **system entries** for creation, stage, owner, attribute changes, archive and task completion — the
  timeline is the audit trail.
- The quick-log bar sets a **next step** (task) by default — CRM "always have a next step" discipline.
  `companies.next_follow_up_at` is denormalised from the earliest open task; `last_activity_at` from logs.
- Archive (manager+) hides a company from lists and reports; there is no hard delete.

## Lists & reports *(built)*
- Filters live in the URL (`src/lib/filters.ts`), so saved views are just stored filters. Built-in views:
  My follow-ups due, Overdue, Unowned, No next step. Reps save private views; managers can share.
- CSV export honours the current filter; cells are formula-injection-safe.
- Reports: pipeline by stage, win rate (won ÷ closed), why we lose, logged activities per rep per week
  (4 weeks), and a breakdown per select/multiselect/bool attribute.

## Deferred (not MVP)
Deals (several opportunities per company), email/calendar sync, named contacts (needs admin sign-off),
daily task digest email, legacy JSON import, audit of settings changes.

## GCP setup & runtime identity *(scripted, not yet run)*
- One-time GCP setup is automated in `scripts/gcp-setup.sh` (Cloud Shell, idempotent — safe to re-run).
  Only the Google sign-in OAuth client is manual; Google exposes no CLI/API for creating it.
- Cloud Run runs as a **dedicated `atlas-runtime` service account** (Secret Manager accessor + Cloud SQL client
  only), not the default compute account. The deployer (`github-deploy`) may act as `atlas-runtime` only.
- The Cloud SQL password is generated by the script and lives in secret `DB_PASS`; nobody types or stores it.
- API keys: Places server key restricted to Places API (New) with **no referrer restriction** (server calls send
  none); Maps browser key restricted to Maps JavaScript API + the app's and localhost referrers.
- Default app URL is Cloud Run's deterministic `https://<service>-<project-number>.<region>.run.app`, so the
  OAuth redirect and key referrers can be set before the first deploy.
