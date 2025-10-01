# Mobile Repo Bootstrap Checklist

## 1. Create Repo
- Create private GitHub repo `inverter-app-mobile`, add `main` branch.
- Add collaborators mirroring API repo permissions.
- Initialize with MIT license and README linking back to API repo.

## 2. Scaffold Expo Project
```sh
npx create-expo-app@latest inverter-app-mobile --template expo-template-blank-typescript
cd inverter-app-mobile
yarn
```
- Enable Expo Prebuild (bare minimum): `expo install expo-secure-store react-native-safe-area-context`.
- Configure `tsconfig.json` for baseUrl imports.

## 3. Repository Layout
```
/
├─ apps/
│  └─ mobile/
├─ packages/
│  ├─ api-client/
│  └─ ui/
└─ docs/
```
- Move Expo project into `apps/mobile`.
- Add Yarn workspaces + Expo Router if applicable.

## 4. Automation
- Add `.github/workflows/mobile-ci.yml` (lint/test/typecheck build).
- Configure Renovate/Dependabot for JS packages.
- Add CODEOWNERS (mobile leads + backend owners for `/packages/api-client`).

## 5. Git Hygiene
- Set branch protection on `main`: require PR, status checks (`mobile-ci`), review.
- Create long-lived integration branch `feature/ios-client`.
- Preconfigure issue templates copied from `docs/mobile/templates/` in API repo.

## 6. Documentation
- Expand README with architecture overview, run scripts, environment variables (API base URL, SSO configs).
- Add `/docs/adr` with first ADR covering Expo managed vs. bare workflow.
- Link back to API repo `docs/mobile/` for cross-reference.

## 7. Secrets & Environment
- Store API base URL, environment toggles in `.env.example` (no secrets).
- For CI, use GitHub Encrypted Secrets: `EXPO_TOKEN`, `API_BASE_URL_STAGING`.
- Document local `.env.development` usage.

## 8. Raspberry Pi Considerations
- Add npm script `yarn web:kiosk` running React Native Web build with Chromium flags.
- Document kiosk setup (autostart script, hardware requirements) in `/docs/kiosk.md`.
