# Mobile Project Board Setup

## Board Columns (GitHub Project Beta)
1. **Backlog** – Groomed features and tech debt awaiting prioritization.
2. **Ready** – Tasks with acceptance criteria, design references, and API endpoints confirmed.
3. **In Progress** – Active development; assignee required.
4. **In Review** – Open pull request linked and reviewer assigned.
5. **QA** – Build available for validation (Expo preview or TestFlight)
6. **Done** – Verified/tested, documentation updated.

## Initial Epics (Convert to Issues)
- Auth & Session Handling (login, token refresh, session persistence, VRM MFA messaging)
- EG4 Dashboard & History (charts, live metrics, polling cadence)
- VRM Dashboard & Insights (device lists, metadata, history views)
- Scheduler Management (queue display, create/edit, attempts/errors surfacing)
- Change Log & Alerts (timeline, push/polling integrations)
- Diagnostics & Health Cards (scheduler status, collectors, VRM token refresh diagnostics)
- Offline & Caching Strategy (query caching, retry queues, kiosk readiness)
- Raspberry Pi Kiosk UX (RN Web build-out, kiosk shell scripts, touch target audit)

## Backlog Seeds
- `feature`: Scaffold Expo app, configure TypeScript, eslint/prettier, absolute imports.
- `feature`: Implement secure storage wrapper (expo-secure-store Keychain + fallback).
- `feature`: API client: generate from FastAPI OpenAPI, wrap REST hooks with React Query.
- `feature`: Dashboard layout baseline (EG4 + VRM cards, placeholder widgets).
- `tech-debt`: Establish app theming (dark mode parity with web dashboards).
- `tech-debt`: Setup Detox + Jest config.
- `tech-debt`: Investigate Expo background fetch for scheduler polling.
- `kiosk`: Spike React Native Web build inside Chromium kiosk on Raspberry Pi OS.

## Workflow Conventions
- Every issue references API endpoints touched and required roles/permissions.
- Attach design mockups or sketches as needed; link to Figma/Whimsical.
- Label hygiene: `feature`, `tech-debt`, `kiosk`, `infra`, `blocked`.
- Standup notes: update issue status daily, include blockers in comments.

## Review Gates
- Definition of Done per column, captured as issue checklist template.
- QA sign-off requires at least one successful end-to-end run against staging API.
- Release candidate board view filters for `Ready for QA` and `release/ios-v*` milestones.
