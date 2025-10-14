# VS Code Test Environment Guide

This guide walks through preparing a macOS development workstation for the Expo/React Native project in `iosapp2`, verifying the setup, and running the app during feature work. Follow the steps in order the first time, then refer back to the relevant sections as you iterate.

## 1. Prerequisites

- macOS with administrator access (Ventura or newer recommended).
- Visual Studio Code installed (https://code.visualstudio.com/).
- Apple ID signed into the App Store (required to install Xcode).
- Reliable internet connection.

## 2. First-Time Tooling Setup

All commands in this section run from the macOS **Terminal** application.

1. **Install Homebrew (optional but recommended)**
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   After installation, follow any on-screen instructions, then close and reopen Terminal so `brew` is available.

2. **Install Node.js 20 and npm 10**
   ```bash
   brew install node@20
   brew link --overwrite --force node@20
   node -v   # expect v20.19.x or newer
   npm -v    # expect 10.x
   ```
   If you previously added Node 18 to your PATH, remove it from `~/.zshrc`, run `source ~/.zshrc`, then rerun the commands above.

3. **Install Watchman**
   ```bash
   brew install watchman
   ```

4. **Install Xcode and Command Line Tools**
   - Open the App Store, search for **Xcode**, click **Get**, then **Install**.
   - Launch Xcode once, accept the license, and let it install any required components.
   - Ensure the command line tools are set:
     ```bash
     xcode-select --install    # skip if it reports they are already installed
     sudo xcode-select -s /Applications/Xcode.app
     ```
   - In Xcode, go to **Window → Devices and Simulators** and make sure at least one iOS simulator (e.g., iPhone 15) exists.

5. **Install Expo CLI Globally (optional)**
   ```bash
   npm install --global expo-cli
   ```
   You can also use `npx expo` without a global install; pick whichever you prefer.

## 3. Repository Setup in VS Code

1. Open VS Code and use **File → Open Folder…** to open `/Users/giovanipiasentin/mobile-client/iosapp2`.
2. Open a terminal inside VS Code (`Ctrl+` `) or go to **View → Terminal**.
3. Confirm the terminal is in the repo root:
   ```bash
   pwd
   ls             # should list apps, packages, package.json, etc.
   ```
4. Install workspace dependencies:
   ```bash
   npm install
   ```
   This should complete without engine warnings now that Node 20 is active.

5. Verify Expo-managed dependencies match the SDK manifest:
   ```bash
   npx expo install --check
   ```
   This cmd reassures Expo that packages such as `react-native-safe-area-context` and `react-native-svg` stay aligned with the current SDK before Metro starts.

6. Copy the environment template and set the FastAPI base URL you plan to target:
   ```bash
   cp .env.example .env
   # edit .env to point EXPO_PUBLIC_API_BASE_URL at your backend
   ```
   Adjust `EXPO_START_MODE`, `EXPO_DEV_PORT`, and `EXPO_LAUNCH_SIMULATOR` as desired; these control how the Expo starter script runs (LAN/localhost/tunnel and whether to auto-open the simulator). Any key that starts with `EXPO_PUBLIC_` is automatically injected into the Expo bundle; keep this terminal open so the variable remains in scope.

7. For day-to-day work it is easiest to let the mobile repo start the backend for you. Use `npm run dev:start:all` (documented below) to boot the FastAPI repo and Metro together. If you prefer to run the backend manually, you can still start it with:
   ```bash
   npm run api:web
   ```
   That command shells into `../inverter-app-api-start` and runs `make web`.

## 4. Verifying the Environment

1. **Run the TypeScript checker**
   ```bash
   npm run typecheck --workspace @inverter/mobile
   ```
   Ensure it reports success before continuing.

2. **Launch the Expo dev server (auto-starts backend, runs preflight checks)**
   ```bash
   npm run dev:start:all
   ```
   The script runs the TypeScript checks for the mobile app and API client, verifies Expo-managed dependencies (`npx expo install --check`), confirms the backend via `dev:check`, auto-starts the FastAPI repo if it is present, then reads `.env` to decide how to launch Expo. With the defaults (`EXPO_START_MODE=lan`, `EXPO_LAUNCH_SIMULATOR=true`) the simulator opens automatically while LAN mode keeps the bundle reachable from phones on the same Wi-Fi.

3. **Hot reload check**
   - Edit `apps/mobile/App.tsx` (e.g., change the displayed text) and save.
   - The simulator should refresh automatically. If not, press `Cmd+R` in the simulator or `r` in the Expo CLI to reload.

## 5. Running on a Physical Device

1. Install **Expo Go** from the App Store (iOS) or Google Play (Android).
2. If the current Expo session is localhost-only, stop it (`Ctrl+C`) and restart in LAN or tunnel mode by overriding the environment for the combined start command:
   ```bash
   EXPO_START_MODE=lan npm run dev:start:all        # LAN mode
   EXPO_START_MODE=tunnel npm run dev:start:all     # Expo tunnel (most compatible across networks)
   EXPO_START_MODE=local npm run dev:start:all      # Localhost (simulator-only)
   ```
3. In the Expo CLI UI, scan the QR code with Expo Go (or type the URL manually). In LAN mode the URL will resemble `exp://<your-mac-ip>:<port>`; in tunnel mode it will be `exp://exp.host/...`.
4. The app should load the same screen you see in the simulator. If connection fails:
   - Confirm the Mac and phone share the same Wi-Fi network (for LAN).
   - Ensure macOS Firewall allows connections for Node.js.
   - Prefer Tunnel mode when networks differ or VPNs are active.

## 6. Day-to-Day Workflow During Feature Development

- Keep the Expo CLI terminal running to provide fast hot reloads.
- Run `npm run typecheck --workspace @inverter/mobile` after significant changes or before commits.
- When updating dependencies, run `npm install`, restart Expo (`Ctrl+C`, rerun the start command), and retest both simulator and Expo Go flows.
- If Metro reports it “could not connect to the server,” adjust `EXPO_START_MODE` and rerun `npm run dev:start:all` (or `npm run dev:start` if you already have the backend running).

## 7. Troubleshooting Quick Reference

| Symptom | Resolution |
| --- | --- |
| `npm install` reports Node engine mismatch | Ensure `node -v` prints ≥ 20.19.x, then re-run `npm install`. |
| Simulator shows “Could not connect to the server” | Set `EXPO_START_MODE=local` and rerun `npm run dev:start:all` (or `npm run dev:start` if the backend is already running), then press `i` if the simulator does not auto-open. |
| Device cannot connect to Expo | Run with `EXPO_START_MODE=tunnel npm run dev:start:all`, ensure the backend uses a reachable IP (not localhost). |
| Metro stuck on old port | Change `EXPO_DEV_PORT` in `.env` and rerun `npm run dev:start:all`. |
| Type checker fails | Fix TypeScript errors reported by `npm run typecheck --workspace @inverter/mobile`. |

Keep this document updated as new tooling or scripts are added to the project. It should remain the single source of truth for reproducing the mobile test environment on any VS Code-equipped Mac.

## Backend Setup Checklist

Use the in-app **Setup** screen (Navigation → Setup) to validate that the FastAPI backend is ready. Each card links directly to the web forms so you can complete configuration from Safari/Chrome if required:

1. **EG4 credentials** – tap **Open Setup Form** (or visit `http://localhost:8000/setup`) to save the EG4 username, password, and base URL.
2. **Select inverter** – choose the active serial under **Open Inverter Selector** (`http://localhost:8000/inverters`) after login succeeds.
3. **Verify samples** – confirm the collector is ingesting data in `/diagnostics`; the card highlights the last timestamp and total count.
4. **Victron VRM (optional)** – use **Open Victron Login** and **Manage Installations** to authorise the VRM token and pick a site when combined dashboards are needed.
5. **Scheduler status** – review outstanding jobs and the latest tick; the button jumps to `/nav` for the full snapshot.

You can now open **Scheduler Console** from the Navigation screen to enqueue new applies without leaving the mobile app. The form mirrors the FastAPI `/schedule` workflow and hands scheduling off to the backend service.

The Setup screen also links back to this guide and the README so you can revisit workstation bootstrapping steps without leaving Expo.

Once Victron is linked, open the **VRM Dashboard** tile in the Navigation screen to adjust the left/right metric defaults and view the same dual-series chart that ships with the web app.
