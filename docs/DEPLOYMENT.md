# Deployment

**Target:** its own GCP project on the **same billing account** as GuestWave, `africa-south1`, Cloud Run
(min-instances 0) + the smallest Cloud SQL Postgres 16 instance. One invoice; separate budget, IAM and cost
breakdown. If the CRM ever needs its own bill, relink the project to another billing account — no migration.
Cost guardrail: under ~$30/month at idle, plus Places usage.

CI (`.github/workflows/deploy.yml`) always runs lint, type-check, migrations and tests (including the tenancy
test against a throwaway Postgres). The **deploy** job runs only when the repo variable `DEPLOY_ENABLED=true`.

## One-time setup (owner does this)
1. **Project:** Console → New project, e.g. `atlas-crm-prod`. Billing → link to the existing billing account.
   Billing → Budgets & alerts → a budget for this project (e.g. $40, alerts at 50/90/100%).
2. **APIs:** enable Cloud Run, Cloud SQL Admin, Artifact Registry, Secret Manager, IAM Credentials,
   Places API (New), Maps JavaScript API.
3. **Artifact Registry:** Docker repo `atlas` in `africa-south1`.
4. **Cloud SQL:** Postgres 16, smallest shared-core tier, `africa-south1`. Create database `atlas` and user
   `atlas` with a generated password.
5. **Google keys** (APIs & Services → Credentials):
   - *Places server key:* restrict to **Places API (New)** only. → secret `GOOGLE_PLACES_API_KEY`.
   - *Maps browser key:* restrict to **Maps JavaScript API** and HTTP referrer `https://<your-domain>/*`.
     → GitHub secret `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` (optional; without it Discover shows a list).
   - Set a Places **quota cap** per day (APIs → Places API → Quotas) so a runaway scan can't surprise you.
6. **OAuth client** (Google Auth Platform): consent screen *Internal* if all staff are on one Google
   Workspace, otherwise *External* in testing mode with test users. Web client with redirect URI
   `https://<your-domain>/api/auth/callback/google` (+ `http://localhost:3000/api/auth/callback/google` for dev).
7. **Secret Manager** secrets: `DATABASE_URL` =
   `postgresql://atlas:<pw>@/atlas?host=/cloudsql/<project>:africa-south1:<instance>`, `AUTH_SECRET`
   (`openssl rand -base64 32`), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ROOT_ADMIN_EMAIL`,
   `GOOGLE_PLACES_API_KEY`. Grant the Cloud Run runtime service account *Secret Manager Secret Accessor*
   and *Cloud SQL Client*.
8. **Deploy identity:** service account `github-deploy` with *Cloud Run Admin*, *Artifact Registry Writer*,
   *Cloud SQL Client*, *Service Account User*. Workload Identity Federation pool + GitHub OIDC provider
   restricted to `paultenbokum-stack/HospitalityAtlas`; allow it to impersonate `github-deploy`.
9. **GitHub** → Settings → Secrets and variables → Actions:
   - Secrets: `GCP_PROJECT_ID`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_DEPLOY_SA`, `CLOUD_RUN_REGION`
     (`africa-south1`), `ARTIFACT_REPO` (`atlas`), `CLOUD_RUN_SERVICE` (`atlas-crm`), `CLOUD_SQL_INSTANCE`
     (`<project>:africa-south1:<instance>`), `DB_USER`, `DB_PASS`, `DB_NAME`, `ROOT_ADMIN_EMAIL`, `APP_URL`,
     `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`.
   - Variable: `DEPLOY_ENABLED` = `true`.
10. First deploy: push to `main`. Sign in with the `ROOT_ADMIN_EMAIL` Google account, then invite the team
    from Settings → People. Optionally map a custom domain in Cloud Run and update `APP_URL` + OAuth redirect.

## Local development
```bash
docker compose up -d postgres
cp .env.example .env.local   # fill AUTH_SECRET; Google/Places keys optional locally
npm run db:migrate && npm run db:seed
npm run dev
```
With `DEV_LOGIN=1` and `SEED_DEV=1`, sign in on `/login` as `admin@dev.local` (superadmin), `rep@dev.local`
(GuestWave rep) or `security-rep@dev.local` (security demo workspace only).
