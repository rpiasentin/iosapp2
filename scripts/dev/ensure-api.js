#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
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
  const hasApiRepo = fs.existsSync(siblingApiRepo);

  const attempts = 2;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await checkHealth(baseUrl);
      console.log(`[api-check] Backend reachable at ${baseUrl}`);
      return;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[api-check] Attempt ${i}/${attempts} failed -> ${reason}`);
      if (i < attempts) {
        await sleep(500);
      }
    }
  }

  console.error(`\n[api-check] Unable to reach FastAPI backend at ${baseUrl}.`);
  if (hasApiRepo) {
    console.error(
      `[api-check] Start it with: (cd ${path.relative(
        process.cwd(),
        siblingApiRepo
      )} && make web)`
    );
  }
  console.error(
    "[api-check] Once the server is running, re-run the command you attempted (e.g., npm run dev:ios)."
  );
  process.exit(1);
}

main().catch((error) => {
  console.error("[api-check] Unexpected failure", error);
  process.exit(1);
});
