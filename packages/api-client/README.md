# @inverter/api-client

TypeScript client for the EG4/Victron FastAPI backend used by the inverter applications. The scaffolding exposes a small set of strongly typed helpers while providing a single place to evolve transport concerns (timeouts, custom headers, error handling).

## Usage

```ts
import { createApiClient } from "@inverter/api-client";

const api = createApiClient({ baseUrl: "https://example.com" });

const health = await api.getHealth();
const runtime = await api.getRuntime();
const schedule = await api.getSchedulerStatus();
```

When running inside the Expo mobile app you can omit `baseUrl` and instead supply `EXPO_PUBLIC_API_BASE_URL` via `.env` / app config.

## Available Methods

- `getHealth()` → `/api/health`
- `getRuntime()` → `/api/runtime`
- `getEnergy()` → `/api/energy`
- `getBattery()` → `/api/battery`
- `getPvHistory(limit?)` → `/api/history/pv`
- `getAlerts()` → `/api/alerts`
- `getSchedulerStatus()` → `/api/scheduler/status`
- `getSchedulerEvents(limit?)` → `/api/scheduler/events`
- `getHistoryKeys()` → `/api/history/keys`
- `getHistoryCustom(params)` → `/api/history/custom`
- `getVrmHealth()` → `/api/victron/health`
- `getVrmHistoryCodes()` → `/api/victron/history/codes`
- `getVrmInstances()` → `/api/victron/devices/instances`
- `getVrmInstanceCodes(instance)` → `/api/victron/devices/instance-codes`
- `getVrmHistoryByCode(params)` → `/api/victron/history/custom-by-code`
- `ping()` shortcut that wraps `getHealth()` with consistent error handling

Each call returns typed data defined in `src/types.ts`. Additional endpoints can be layered on incrementally using the internal `request` helper.

## Local Development

```bash
# Type check the package in isolation
npm run typecheck --workspace @inverter/api-client
```

Because the package ships TypeScript sources (compiled by Metro/Babel), ensure we keep the module API language-level features compatible with the React Native bundler (ES2020).

### Working with EG4 + VRM history

The combined dashboard math flow calls into the history helpers to mix EG4 and VRM metrics:

- `HistoryCustomParams` lets you pull any EG4 key with optional limits or rolling windows.
- `VrmHistoryParams` adds per-instance filtering (`linst`/`rinst`) so a mobile user can chart a specific MPPT or alias.
- `VrmHistoryCodes`, `VrmInstances`, and `VrmInstanceCodes` power dropdowns that mirror the FastAPI `/combined/math` UI.

When onboarding additional backend endpoints, expose them through the same `request` helper so both Expo and web clients remain in lock-step with the FastAPI contract.
