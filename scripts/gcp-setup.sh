#!/usr/bin/env bash
# Atlas CRM — one-time GCP setup for Cloud Run deploys (see docs/DEPLOYMENT.md).
#
# Run in Google Cloud Shell:   bash scripts/gcp-setup.sh
# Re-runnable: every step checks whether its resource already exists and skips it, so if something
# fails part-way, fix it and run the script again.
#
# Automated: project + billing link + budget, APIs, Artifact Registry, Cloud SQL (generated password),
# Places + Maps API keys, Secret Manager, runtime + deploy service accounts, Workload Identity Federation,
# and (optionally, via the gh CLI) the GitHub Actions secrets + DEPLOY_ENABLED variable.
# Manual (Google offers no CLI for it): the OAuth web client for Google sign-in — the script pauses for it.
set -euo pipefail

# ---- config (override any of these as env vars) --------------------------------
PROJECT_ID="${PROJECT_ID:-atlas-crm-prod}"
REGION="${REGION:-africa-south1}"                    # Johannesburg
REPO_SLUG="${REPO_SLUG:-paultenbokum-stack/HospitalityAtlas}"
AR_REPO="${AR_REPO:-atlas}"
SQL_INSTANCE="${SQL_INSTANCE:-atlas-pg}"
SQL_TIER="${SQL_TIER:-db-f1-micro}"                  # smallest shared-core (Enterprise edition)
DB_NAME="${DB_NAME:-atlas}"
DB_USER="${DB_USER:-atlas}"
CR_SERVICE="${CR_SERVICE:-atlas-crm}"
RUNTIME_SA="${RUNTIME_SA:-atlas-runtime}"
DEPLOY_SA="${DEPLOY_SA:-github-deploy}"
POOL="${POOL:-github-pool}"
PROVIDER="${PROVIDER:-github-provider}"
# --------------------------------------------------------------------------------

step() { printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
info() { printf '   %s\n' "$*"; }
ask()  { local p="$1" d="${2:-}" v; read -rp "   $p${d:+ [$d]}: " v; printf '%s' "${v:-$d}"; }
yes()  { local v; read -rp "   $1 [y/N]: " v; [[ "$v" =~ ^[Yy] ]]; }

# Create a secret, or add a new version if it already exists (value via stdin, never argv).
put_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
    info "secret $name: new version added"
  else
    printf '%s' "$value" | gcloud secrets create "$name" --replication-policy=automatic --data-file=- >/dev/null
    info "secret $name: created"
  fi
}
secret_exists() { gcloud secrets describe "$1" >/dev/null 2>&1; }
read_secret()   { gcloud secrets versions access latest --secret="$1" 2>/dev/null; }

grant() { # grant <member> <role>
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="$1" --role="$2" --condition=None >/dev/null
}

ME="$(gcloud config get-value account 2>/dev/null)"
[[ -n "$ME" ]] || { echo "Not signed in to gcloud. Run: gcloud auth login"; exit 1; }
echo "Signed in as $ME. Project: $PROJECT_ID, region: $REGION, repo: $REPO_SLUG"
yes "Continue with these settings?" || exit 0

# ---- 1. Project, billing, budget -------------------------------------------------
step "1/10 Project + billing"
if gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  info "project exists"
elif ! gcloud projects create "$PROJECT_ID" --name="Atlas CRM"; then
  echo
  echo "Couldn't create project '$PROJECT_ID'. Project IDs are unique across all of Google Cloud, so it may"
  echo "belong to someone else. Your projects:"
  gcloud projects list --format='table(projectId, name)'
  echo "Re-run with an existing ID from the list, or a new unique one:  PROJECT_ID=<id> bash $0"
  exit 1
fi
gcloud config set project "$PROJECT_ID" >/dev/null
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

BILLING_ACCOUNT="$(gcloud billing projects describe "$PROJECT_ID" --format='value(billingAccountName)' | sed 's#billingAccounts/##')"
if [[ -z "$BILLING_ACCOUNT" ]]; then
  info "Open billing accounts you can use (link the same one as GuestWave):"
  gcloud billing accounts list --filter=open=true --format='table(name.basename():label=ID, displayName)'
  BILLING_ACCOUNT="$(ask "Billing account ID")"
  gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
else
  info "billing linked: $BILLING_ACCOUNT"
fi

step "2/10 Enable APIs"
gcloud services enable \
  run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  places.googleapis.com maps-backend.googleapis.com apikeys.googleapis.com \
  billingbudgets.googleapis.com cloudresourcemanager.googleapis.com
info "done"

step "3/10 Budget alert"
if gcloud billing budgets list --billing-account="$BILLING_ACCOUNT" \
     --filter="displayName='Atlas CRM'" --format='value(name)' 2>/dev/null | grep -q .; then
  info "budget 'Atlas CRM' exists"
else
  CURRENCY="$(gcloud billing accounts describe "$BILLING_ACCOUNT" --format='value(currencyCode)' 2>/dev/null || true)"
  CURRENCY="${CURRENCY:-USD}"
  AMOUNT="$(ask "Monthly budget for this project in $CURRENCY" "$([[ $CURRENCY == ZAR ]] && echo 750 || echo 40)")"
  gcloud billing budgets create --billing-account="$BILLING_ACCOUNT" --display-name="Atlas CRM" \
    --budget-amount="${AMOUNT}${CURRENCY}" --filter-projects="projects/${PROJECT_ID}" \
    --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0 >/dev/null
  info "budget created: ${AMOUNT} ${CURRENCY}/month, alerts at 50/90/100% (emailed to billing admins)"
fi

# ---- 2. Artifact Registry + Cloud SQL ---------------------------------------------
step "4/10 Artifact Registry ($AR_REPO)"
if gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" >/dev/null 2>&1; then
  info "exists"
else
  gcloud artifacts repositories create "$AR_REPO" --repository-format=docker --location="$REGION" \
    --description="Atlas CRM images"
fi

step "5/10 Cloud SQL Postgres 16 ($SQL_TIER) — creating an instance takes ~10 minutes"
if gcloud sql instances describe "$SQL_INSTANCE" >/dev/null 2>&1; then
  info "instance exists"
else
  gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 --edition=ENTERPRISE --tier="$SQL_TIER" \
    --region="$REGION" --storage-size=10GB --storage-auto-increase \
    --availability-type=zonal --backup-start-time=01:00
fi
SQL_CONN="$(gcloud sql instances describe "$SQL_INSTANCE" --format='value(connectionName)')"

if gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" >/dev/null 2>&1; then
  info "database $DB_NAME exists"
else
  gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE"
fi
# The DB password is generated and kept in Secret Manager (DB_PASS) — nobody needs to type it.
if secret_exists DB_PASS; then
  DB_PASS="$(read_secret DB_PASS)"
  info "reusing DB password from secret DB_PASS"
else
  DB_PASS="$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-32)"
  put_secret DB_PASS "$DB_PASS"
fi
if gcloud sql users list --instance="$SQL_INSTANCE" --format='value(name)' | grep -qx "$DB_USER"; then
  gcloud sql users set-password "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS" >/dev/null
  info "user $DB_USER exists (password synced)"
else
  gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS"
fi

# ---- 3. URL, API keys ------------------------------------------------------------
# Cloud Run's deterministic URL — known before the first deploy. Swap for a custom domain later.
DEFAULT_URL="https://${CR_SERVICE}-${PROJECT_NUMBER}.${REGION}.run.app"
APP_URL="$(ask "App URL (use the default unless you already have a custom domain)" "$DEFAULT_URL")"
APP_HOST="${APP_URL#https://}"; APP_HOST="${APP_HOST%%/*}"

step "6/10 Google Maps/Places API keys"
key_string() { # key_string <display-name> → key value, or empty if the key doesn't exist
  local k; k="$(gcloud services api-keys list --filter="displayName='$1'" --format='value(name)' | head -n1)"
  [[ -n "$k" ]] && gcloud services api-keys get-key-string "$k" --format='value(keyString)'
}
PLACES_KEY="$(key_string 'Atlas Places (server)' || true)"
if [[ -z "$PLACES_KEY" ]]; then
  # Server key: API restriction only. NO referrer restriction — server calls send no referrer (403).
  gcloud services api-keys create --display-name='Atlas Places (server)' \
    --api-target=service=places.googleapis.com >/dev/null
  PLACES_KEY="$(key_string 'Atlas Places (server)')"
  info "created server key 'Atlas Places (server)' (Places API (New) only)"
else
  info "server key exists"
fi
put_secret GOOGLE_PLACES_API_KEY "$PLACES_KEY"

MAPS_KEY="$(key_string 'Atlas Maps (browser)' || true)"
if [[ -z "$MAPS_KEY" ]]; then
  gcloud services api-keys create --display-name='Atlas Maps (browser)' \
    --api-target=service=maps-backend.googleapis.com \
    --allowed-referrers="https://${APP_HOST}/*,http://localhost:3000/*,http://localhost:3100/*" >/dev/null
  MAPS_KEY="$(key_string 'Atlas Maps (browser)')"
  info "created browser key 'Atlas Maps (browser)' (Maps JavaScript API, referrers: ${APP_HOST}, localhost)"
else
  info "browser key exists (if the app URL changed, update its referrers in the console)"
fi

# ---- 4. OAuth client (manual) + runtime secrets -------------------------------------
step "7/10 Google sign-in OAuth client (manual — no CLI exists for this)"
if secret_exists AUTH_GOOGLE_ID && secret_exists AUTH_GOOGLE_SECRET; then
  info "AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET already stored"
else
  cat <<EOF
   In another tab:
   1. https://console.cloud.google.com/auth/overview?project=${PROJECT_ID}
      Get started → app name "Atlas CRM", support email → Audience: Internal if all staff share one Google
      Workspace, otherwise External (then add staff as test users) → Create.
   2. Clients → Create client → Web application, name "Atlas CRM"
      Authorised redirect URIs:
        ${APP_URL}/api/auth/callback/google
        http://localhost:3100/api/auth/callback/google
   3. Copy the client ID and secret, then paste them here.
EOF
  V="$(ask "OAuth client ID")"; put_secret AUTH_GOOGLE_ID "$V"
  read -rsp "   OAuth client secret: " V; echo; put_secret AUTH_GOOGLE_SECRET "$V"
fi

step "8/10 Runtime secrets"
put_secret DATABASE_URL "postgresql://${DB_USER}:${DB_PASS}@/${DB_NAME}?host=/cloudsql/${SQL_CONN}"
secret_exists AUTH_SECRET && info "AUTH_SECRET exists (kept, so sessions survive)" || put_secret AUTH_SECRET "$(openssl rand -base64 32)"
if secret_exists ROOT_ADMIN_EMAIL; then
  ROOT_ADMIN="$(read_secret ROOT_ADMIN_EMAIL)"; info "ROOT_ADMIN_EMAIL exists ($ROOT_ADMIN)"
else
  ROOT_ADMIN="$(ask "First admin's Google email (can sign in without an invite)" "$ME")"
  put_secret ROOT_ADMIN_EMAIL "$ROOT_ADMIN"
fi

# ---- 5. Service accounts + Workload Identity Federation -----------------------------
step "9/10 Service accounts + GitHub Workload Identity Federation"
RUNTIME_SA_EMAIL="${RUNTIME_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOY_SA_EMAIL="${DEPLOY_SA}@${PROJECT_ID}.iam.gserviceaccount.com"
for sa in "$RUNTIME_SA:Atlas CRM runtime" "$DEPLOY_SA:GitHub Actions deployer"; do
  id="${sa%%:*}"; name="${sa#*:}"
  gcloud iam service-accounts describe "${id}@${PROJECT_ID}.iam.gserviceaccount.com" >/dev/null 2>&1 \
    || gcloud iam service-accounts create "$id" --display-name="$name"
done
# Runtime: only what the running app needs.
for role in roles/secretmanager.secretAccessor roles/cloudsql.client; do
  grant "serviceAccount:${RUNTIME_SA_EMAIL}" "$role"
done
# Deployer: push images, deploy Cloud Run, reach Cloud SQL for migrations, act as the runtime SA.
for role in roles/run.admin roles/artifactregistry.writer roles/cloudsql.client; do
  grant "serviceAccount:${DEPLOY_SA_EMAIL}" "$role"
done
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA_EMAIL" \
  --member="serviceAccount:${DEPLOY_SA_EMAIL}" --role=roles/iam.serviceAccountUser >/dev/null

gcloud iam workload-identity-pools describe "$POOL" --location=global >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub pool"
gcloud iam workload-identity-pools providers describe "$PROVIDER" --location=global --workload-identity-pool="$POOL" >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" \
       --location=global --workload-identity-pool="$POOL" --display-name="GitHub provider" \
       --issuer-uri="https://token.actions.githubusercontent.com" \
       --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
       --attribute-condition="assertion.repository=='${REPO_SLUG}'"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA_EMAIL" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${REPO_SLUG}" >/dev/null
WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"
info "GitHub repo ${REPO_SLUG} can deploy as ${DEPLOY_SA_EMAIL} (no JSON keys)"

# ---- 6. GitHub Actions config --------------------------------------------------------
step "10/10 GitHub Actions secrets"
declare -A GH=(
  [GCP_PROJECT_ID]="$PROJECT_ID"
  [GCP_WORKLOAD_IDENTITY_PROVIDER]="$WIF_PROVIDER"
  [GCP_DEPLOY_SA]="$DEPLOY_SA_EMAIL"
  [CLOUD_RUN_RUNTIME_SA]="$RUNTIME_SA_EMAIL"
  [CLOUD_RUN_REGION]="$REGION"
  [ARTIFACT_REPO]="$AR_REPO"
  [CLOUD_RUN_SERVICE]="$CR_SERVICE"
  [CLOUD_SQL_INSTANCE]="$SQL_CONN"
  [DB_USER]="$DB_USER"
  [DB_NAME]="$DB_NAME"
  [DB_PASS]="$DB_PASS"
  [ROOT_ADMIN_EMAIL]="$ROOT_ADMIN"
  [APP_URL]="$APP_URL"
  [NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY]="$MAPS_KEY"
)
if command -v gh >/dev/null && yes "Set these directly on GitHub with the gh CLI (asks you to log in if needed)?"; then
  gh auth status >/dev/null 2>&1 || gh auth login --hostname github.com --git-protocol https --web
  for k in "${!GH[@]}"; do printf '%s' "${GH[$k]}" | gh secret set "$k" --repo "$REPO_SLUG" >/dev/null; info "secret $k set"; done
  if yes "Turn on automatic deploys now (repo variable DEPLOY_ENABLED=true)?"; then
    gh variable set DEPLOY_ENABLED --repo "$REPO_SLUG" --body true
    info "DEPLOY_ENABLED=true — the next push to main deploys"
  fi
else
  echo "   Add these at https://github.com/${REPO_SLUG}/settings/secrets/actions :"
  for k in "${!GH[@]}"; do
    case "$k" in DB_PASS) printf '     %-36s = (run: gcloud secrets versions access latest --secret=DB_PASS)\n' "$k" ;;
                 *) printf '     %-36s = %s\n' "$k" "${GH[$k]}" ;; esac
  done
  echo "   …and the repository variable DEPLOY_ENABLED = true (Variables tab)."
fi

cat <<EOF

Done. Remaining manual steps:
  • Places quota cap (protects the bill): https://console.cloud.google.com/apis/api/places.googleapis.com/quotas?project=${PROJECT_ID}
    e.g. cap "SearchTextRequest per day" at 500.
  • Deploy: push to main (or re-run the Deploy workflow) once DEPLOY_ENABLED=true.
  • Then open ${APP_URL}, sign in as ${ROOT_ADMIN}, and invite the team under Settings → People.
EOF
