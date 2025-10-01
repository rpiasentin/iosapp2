# React Native Client Delivery Strategy (GitHub First)

## Branching & Environments
- Create long-lived `feature/ios-client` as integration branch; keep rebased from `main` weekly.
- For scoped work, branch from `feature/ios-client` using `feature/ios-client/<workstream>` (e.g., `feature/ios-client/auth-flow`).
- Hotfixes for API remain on `main`; backport essential API changes into `feature/ios-client` via fast-forward PRs.

## Repository Structure
- Create sibling repo `inverter-app-mobile` (private). Mirror `README` high-level context and link to API repo. Use Expo-managed React Native (TypeScript).
- Add shared API typing package: extract OpenAPI spec from FastAPI (`/openapi.json`), generate TypeScript clients via GitHub Action into `packages/api-client` (publish as GitHub Package npm).
- Configure monorepo-friendly layout: `apps/mobile` (Expo), `packages/api-client`, `packages/ui` (shared components).

## Issue & Project Tracking
- Spin up GitHub Project (Beta) board "Mobile Client" tracking Backlog → In Progress → Review → QA → Done.
- Seed epics as draft issues: Auth/session, Dashboards, Scheduler, Diagnostics, Alerts, Offline cache, Pi kiosk.
- Use issue templates: Feature Request (screens, API endpoints, acceptance), Tech Task (deps, build tooling), Bug.

## Pull Request Flow
- Require PRs into `feature/ios-client` with: linked issue, screenshots or screen recordings (Expo Go) for UI changes, checklist for tests (`yarn test`, `expo-doctor`).
- Enforce codeowners: mobile leads + backend reviewer for API contract touching changes.
- Use PR labels for environment readiness: `needs-backend`, `qa-blocked`, `ready-for-qa`.

## Continuous Integration
- GitHub Actions workflow `mobile-ci.yml`:
  - Install dependencies with `yarn install --frozen-lockfile`.
  - Run lint (`yarn lint`), tests (`yarn test`), typecheck (`yarn tsc`), Expo Prebuild validation.
  - On `main`/release branches, build Expo EAS preview bundles.
- Nightly job hits API staging (`feature/ios-client` backend) to run Detox smoke tests on iOS simulator (GitHub-hosted macOS runner).

## Release Strategy
- Maintain `release/ios-vX.Y` branches cut from `feature/ios-client` when a milestone closes; tag builds for TestFlight via EAS.
- Draft release notes in repo using changesets, highlighting backend compatibility and VRM auth considerations.
- After production approval, merge `feature/ios-client` into `main`, then delete and recreate integration branch from new `main` head.

## Documentation & Knowledge Sharing
- Add `/docs/mobile` (this file) to API repo linking to mobile repo wikis.
- Maintain architecture decision records (ADRs) for expo workflow, offline caching strategy, Raspberry Pi kiosk approach.
- Record Loom walkthroughs of key features; link inside issues and README.

## Raspberry Pi Touchscreen Path
- Keep UI layer platform-agnostic (React Native primitives + React Native Web compatibility).
- Track kiosk-specific issues (touch targets, auto-refresh, offline) under dedicated milestone.
- Prototype Pi deployment via `expo export` → React Native Web bundle served by lightweight Node/Express container; document kiosk setup scripts in mobile repo.

## Next Steps
1. Create `inverter-app-mobile` repo with default Expo template (`npx create-expo-app`).
2. Configure branch protections & CODEOWNERS aligned with strategy.
3. Author initial issues/epics and populate project board.
4. Scaffold API client package generation pipeline from FastAPI OpenAPI spec.
