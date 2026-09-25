# Plan

**One-liner:** a simple shared CRM for a small sales team — prospect lists, activity logging, classification
and loss reasons — with Google Maps discovery as a feeder.

## Users
Reps (work their companies, log calls/visits, set next steps), managers (pipeline, reports, shared views),
admins (settings, people). First workspace: GuestWave hospitality sales. Later: other businesses (e.g. a
security SaaS) in their own workspaces.

## Milestones
| | Scope | Status |
|---|---|---|
| M0 | Scaffold, schema + migration, seed, Google SSO + invites, workspace context, Vitest | ✅ built |
| M1 | Companies list, company page, timeline, quick log + next step, tasks, manual add with duplicate check | ✅ built |
| M2 | Pipeline board, outcome reasons, attributes, Settings | ✅ built |
| M3 | Discover (server-side Places scan, add to CRM, dedupe) | ✅ built |
| M4 | Saved views, Reports, CSV export | ✅ built · task digest email deferred |
| M5 | Legacy import (place ids + contacted flag only) | not started |
| — | CI/CD to own GCP project | workflow written; GCP setup pending (see DEPLOYMENT.md) |

## Non-goals (flag, don't build)
Named contacts / personal data, email or calendar sync, marketing automation, quotes/invoicing, deals with
line items, mobile app, public API.
