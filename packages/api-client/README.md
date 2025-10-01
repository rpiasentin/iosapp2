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
- `ping()` shortcut that wraps `getHealth()` with consistent error handling

Each call returns typed data defined in `src/types.ts`. Additional endpoints can be layered on incrementally using the internal `request` helper.

## Local Development

```bash
# Type check the package in isolation
npm run typecheck --workspace @inverter/api-client
```

Because the package ships TypeScript sources (compiled by Metro/Babel), ensure we keep the module API language-level features compatible with the React Native bundler (ES2020).
