# iosapp2 Monorepo

This Expo-managed React Native workspace hosts the inverter mobile client alongside shared packages. The repo is organised as an npm workspace with the following key ingredients:

- **apps/mobile** – Expo application containing navigation, dashboard, combined math editor, and utility hooks.
- **packages/api-client** – Typed TypeScript wrapper around the FastAPI backend (EG4 + Victron VRM endpoints).
- **packages/ui** – Reusable React Native primitives (cards, section headers, key-value rows, status pills) used across screens.
- **scripts/dev** – Node scripts that validate dependencies/backends and launch Expo with consistent preflight checks.

## Current Feature Set

- **Navigation hub** replicates `/nav` from the web UI with live status badges for EG4, VRM, and scheduler endpoints.
- **Setup checklist** guides onboarding by surfacing EG4 credentials, inverter selection, VRM linking, and scheduler health from the mobile app.
- **VRM dashboard** mirrors the web selectors for Victron metrics with dual-series charting and default persistence.
- **Dashboard screen** renders health, alerts, power metrics, energy totals, scheduler events, and PV history using shared components.
- **Combined Math editor** lets users configure up to four KPIs across EG4/VRM plus a calculated sum column, adjust scaling per series, and preview data with a new `LineChart` component.
- **Full-screen graph** – tapping the chart opens a modal that honours safe areas (no overlap with camera islands) and exposes Portrait/Landscape orientation toggles via `expo-screen-orientation`.
- **Scheduler console** surfaces queue health, event history, and a mobile-friendly form to enqueue new setting applies via the backend scheduler.
- **Shared formatting** utilities normalise numeric and temporal values for consistent rendering across cards and charts.
- **Start script preflight** runs `npx expo install --check`, TypeScript checks for both workspaces, and backend availability checks before starting Metro. Use `npm run dev:start:all` to perform the preflight, auto-start the sibling FastAPI repo when it's available, and then launch Metro.
- **Git guardrails** include a pre-push hook that blocks publishing if the sibling FastAPI repo (`../inverter-app-api-start`) is dirty or not synced with its upstream. Run `git config core.hooksPath .githooks` once after cloning to activate it.

## Architectural Notes

- The Expo app consumes the backend exclusively through `@inverter/api-client`. All new REST endpoints should be added to that package so both mobile and web (if applicable) consume the same contract.
- UI primitives are published via `@inverter/ui`. Keep layout-sensitive components (cards, selectors, badges) here to minimise duplication.
- `LineChart` is a thin wrapper around `react-native-svg`. It now supports axes, tick labels, and touch affordances.
- Orientation handling lives inside `CombinedMathScreen` and is isolated to the modal workflow. Any future full-screen charts should reuse the same helpers.

## Planned / Open Work

- Persist combined math selections so users can save presets aligned with FastAPI combined metrics.
- Port scheduler management, settings editor, and VRM dashboards from the web experience into native screens.
- Add automated tests (unit and integration) around data-fetch hooks and chart series assembly.
- Consider a dedicated context/store for shared API data (health, alerts) to reduce duplicate fetches as more screens come online.

## Developer Workflow

```bash
# install workspace dependencies
npm install

# ensure Expo-managed packages match the SDK manifest
npx expo install --check

# start backend + Expo (runs preflight, auto-starts FastAPI, launches Metro)
npm run dev:start:all

# launch Expo only (assumes backend already running)
npm run dev:start
```

Use `vscodetestreadme.md` for the full VS Code setup, simulator tips, and troubleshooting notes.

## Setup Checklist

Open **Setup** from the Navigation hub in the Expo app to confirm that the backend is ready before exploring dashboards. The checklist includes:

1. **Connect EG4 account** – launches `/setup` so you can store credentials and the monitoring base URL.
2. **Select primary inverter** – opens `/inverters` to set the active serial once login succeeds.
3. **Verify data ingestion** – links to `/diagnostics` for sample counts and freshness checks.
4. **Link Victron VRM (optional)** – deep links to `/victron/login` and `/victron/installations` for token and site selection.
5. **Scheduler status** – surfaces queue length, last tick, and the most recent error alongside a shortcut back to `/nav`.

Each card also exposes quick links to the README and VS Code guide so you can reference the workstation and backend setup steps without leaving the app.

After the Victron token and installation are configured, open **VRM Dashboard** from the Navigation hub to trend two metrics side-by-side and adjust the saved defaults used by the backend aliases.

### Freeing a Busy Backend Port

If `npm run api:web` reports "Address already in use" (usually when a previous Uvicorn session is still running), free the port before restarting the stack:

```bash
lsof -nP -iTCP:8000 | grep LISTEN   # find the PID holding the port
kill <pid>                          # stop it cleanly
# or force if it refuses: kill -9 <pid>
```

Re-run `npm run api:web` once the process exits. Adjust the port in `EXPO_PUBLIC_API_BASE_URL` if you intentionally run the backend on a different port.
