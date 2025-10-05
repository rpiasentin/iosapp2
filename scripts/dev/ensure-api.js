#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const readline = require("readline");
const { setTimeout: sleep } = require("timers/promises");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }
    const idx = line.indexOf("=");
    if (idx === -1) {
      continue;
    }
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    out[key] = value.replace(/^"|"$/g, "");
  }
  return out;
}

function resolveBaseUrl() {
  const inline = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (inline && inline.trim()) {
    return inline.trim();
  }

  const envPath = path.resolve(process.cwd(), ".env");
  const envValues = parseEnvFile(envPath);
  const fromFile = envValues.EXPO_PUBLIC_API_BASE_URL;
  if (fromFile && fromFile.trim()) {
    return fromFile.trim();
  }

  return null;
}

async function checkHealth(baseUrl) {
  const target = new URL("/api/health", baseUrl).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(target, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
    }
    await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function ensureLocalExpoEnv(baseUrl) {
  const rootEnvPath = path.resolve(process.cwd(), ".env");
  const expoEnvPath = path.resolve(process.cwd(), "apps/mobile/.env");
  const rootExists = fs.existsSync(rootEnvPath);
  const rootContent = rootExists ? fs.readFileSync(rootEnvPath, "utf8") : null;

  try {
    if (!fs.existsSync(expoEnvPath)) {
      if (rootExists) {
        fs.copyFileSync(rootEnvPath, expoEnvPath);
        console.log(`[api-check] Created apps/mobile/.env (copied from ${path.basename(rootEnvPath)})`);
      } else {
        fs.writeFileSync(
          expoEnvPath,
          `EXPO_PUBLIC_API_BASE_URL=${baseUrl}\n`,
          "utf8"
        );
        console.log(`[api-check] Created apps/mobile/.env with base URL ${baseUrl}`);
      }
      return;
    }

    if (rootContent) {
      const current = fs.readFileSync(expoEnvPath, "utf8");
      if (current !== rootContent) {
        fs.copyFileSync(rootEnvPath, expoEnvPath);
        console.log(`[api-check] Synced apps/mobile/.env with ${path.basename(rootEnvPath)}`);
      }
      return;
    }

    const current = fs.readFileSync(expoEnvPath, "utf8");
    if (!current.includes(`EXPO_PUBLIC_API_BASE_URL=${baseUrl}`)) {
      fs.appendFileSync(expoEnvPath, `EXPO_PUBLIC_API_BASE_URL=${baseUrl}\n`, "utf8");
      console.log(`[api-check] Appended base URL ${baseUrl} to apps/mobile/.env`);
    }
  } catch (error) {
    console.warn(`[api-check] Unable to sync apps/mobile/.env: ${error}`);
  }
}

async function waitForHealth(baseUrl, attempts, delayMs) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await checkHealth(baseUrl);
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[api-check] Attempt ${i}/${attempts} failed -> ${reason}`);
      if (i < attempts) {
        await sleep(delayMs);
      }
    }
  }
  return false;
}

function hasSiblingRepo(siblingPath) {
  try {
    return fs.existsSync(siblingPath);
  } catch (_error) {
    return false;
  }
}

function parseBooleanFlag(value) {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "y" ||
    normalized === "on"
  );
}

function isInteractive() {
  return Boolean(
    process.stdin.isTTY &&
      process.stdout.isTTY &&
      !parseBooleanFlag(process.env.CI) &&
      !parseBooleanFlag(process.env.EXPO_NON_INTERACTIVE)
  );
}

async function promptForStart() {
  if (!isInteractive()) {
    return false;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = () =>
    new Promise((resolve) => {
      rl.question("[api-check] Start FastAPI backend now? (y/N) ", (answer) => {
        resolve(parseBooleanFlag(answer));
      });
    });

  const result = await question();
  rl.close();
  return result;
}

async function startBackendProcess() {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  return await new Promise((resolve) => {
    try {
      const child = spawn(npmCmd, ["run", "api:web"], {
        cwd: process.cwd(),
        stdio: "ignore",
        detached: true,
        shell: process.platform === "win32",
      });

      let settled = false;
      let timeout;

      const finish = (value) => {
        if (!settled) {
          settled = true;
          if (timeout) {
            clearTimeout(timeout);
          }
          resolve(value);
        }
      };

      timeout = setTimeout(() => {
        finish(true);
      }, 1000);

      child.on("error", (error) => {
        console.error(
          `[api-check] Failed to launch backend: ${error instanceof Error ? error.message : String(error)}`
        );
        finish(false);
      });

      child.on("exit", (code) => {
        const label = code === null ? "unknown" : code;
        console.error(`[api-check] Backend process exited early with code ${label}.`);
        finish(false);
      });

      child.unref();
    } catch (error) {
      console.error(
        `[api-check] Failed to launch backend: ${error instanceof Error ? error.message : String(error)}`
      );
      resolve(false);
    }
  });
}

function printManualInstructions(siblingPath) {
  console.error(
    `\n[api-check] Unable to reach FastAPI backend. Start it manually from ${path.relative(
      process.cwd(),
      siblingPath
    )} with: npm run api:web`
  );
  console.error(
    "[api-check] Once the server is running, log into both EG4 and Victron instances and ensure polling succeeds before re-running this command."
  );
  console.error(
    "[api-check] Tip: export EXPO_AUTO_START_API=true to skip the prompt and auto-start the backend during future runs."
  );
}

async function main() {
  const baseUrl = resolveBaseUrl();
  if (!baseUrl) {
    console.error(
      "[api-check] Missing EXPO_PUBLIC_API_BASE_URL. Populate .env or export the variable before running the app."
    );
    process.exit(1);
  }

  ensureLocalExpoEnv(baseUrl);

  const siblingApiRepo = path.resolve(process.cwd(), "../inverter-app-api-start");

  const initialReady = await waitForHealth(baseUrl, 2, 500);
  if (initialReady) {
    console.log(`[api-check] Backend reachable at ${baseUrl}`);
    return;
  }

  console.error(`\n[api-check] Unable to reach FastAPI backend at ${baseUrl}.`);

  if (!hasSiblingRepo(siblingApiRepo)) {
    printManualInstructions(siblingApiRepo);
    process.exit(1);
  }

  const autoStart = parseBooleanFlag(process.env.EXPO_AUTO_START_API);
  const shouldStart = autoStart || (await promptForStart());

  if (!shouldStart) {
    printManualInstructions(siblingApiRepo);
    process.exit(1);
  }

  console.log("[api-check] Starting FastAPI backend via npm run api:web…");
  const launched = await startBackendProcess();
  if (!launched) {
    printManualInstructions(siblingApiRepo);
    process.exit(1);
  }

  console.log(
    "[api-check] Backend launching in the background. Run npm run api:web manually if you need to inspect logs."
  );

  console.log("[api-check] Waiting for backend to become healthy…");
  const started = await waitForHealth(baseUrl, 20, 1500);
  if (!started) {
    console.error("[api-check] Backend did not become healthy in time.");
    printManualInstructions(siblingApiRepo);
    process.exit(1);
  }

  console.log(`[api-check] Backend reachable at ${baseUrl}`);
  console.log(
    "[api-check] Reminder: log into both FastAPI web UI and the mobile client to confirm EG4 and Victron polling succeeds."
  );
}

main().catch((error) => {
  console.error("[api-check] Unexpected failure", error);
  process.exit(1);
});
