# Hospitality Atlas

Prospecting CRM for South African hospitality venues: Google Maps/Places discovery by market preset or custom
viewport, a prospect list, and per-prospect CRM notes/status. Split out of the partner `GuestWaveSalesEngine`
repo (`saffykyle-blip/GuestWaveSalesEngine`, commit `c88add5`) as a separate product from GuestWave.

## Run locally
Double-click `START_V5_2_0_LOCAL.bat` (needs Python 3) → http://localhost:8000/?build=5.2.0

Paste a Google Maps JavaScript API key (Maps + Places enabled, HTTP-referrer restricted) into the key field in the app; it's
kept in the browser's localStorage, never in the repo.

## Layout
| Path | What |
|---|---|
| `index.html`, `app.js`, `styles.css` | Standalone V5.2.0 app (vanilla JS, no build step) |
| `config.js` | Defaults + `window.HOSPITALITY_ATLAS_RUNTIME_CONFIG` overrides (market presets, backend mode) |
| `repository.js` | Storage abstraction: `local` (browser localStorage) or `rest` (`backend.baseUrl` + bearer token) |
| `reference/nextjs-port/` | The React/Next.js port that lived at `/admin/atlas` in the sales engine — reference only, not wired up |
| `docs/` | V5.2.0 release notes and the developer integration guide (.docx) |

## Data
In `local` mode all prospects and CRM notes live only in the user's browser (keys `ballito_v5_prospect_refs`,
`ballito_v5_crm`). No prospect data was carried over in this split. Before adding a `rest` backend, decide what
contact-person data (if any) is stored and how — see Next steps.

## Next steps
- Pick one codebase: keep the standalone app, or promote `reference/nextjs-port/` into a real Next.js app.
- Stand up the `rest` backend (the adapter contract is in `repository.js`).
- Add auth before it's deployed anywhere public.
