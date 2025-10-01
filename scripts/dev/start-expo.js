#!/usr/bin/env node
"use strict";

const { spawnSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

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

function getConfig() {
  const envPath = path.resolve(process.cwd(), ".env");
  const fileValues = parseEnvFile(envPath);
  const resolver = (key, fallback) => {
    const direct = process.env[key];
    if (direct && direct.trim()) {
      return direct.trim();
    }
    const fromFile = fileValues[key];
    if (fromFile && fromFile.trim()) {
      return fromFile.trim();
    }
    return fallback;
  };

  return {
    mode: (resolver("EXPO_START_MODE", "lan") || "lan").toLowerCase(),
    port: parseInt(resolver("EXPO_DEV_PORT", "8083"), 10) || 8083,
    launchSimulator: (resolver("EXPO_LAUNCH_SIMULATOR", "true") || "true")
      .toLowerCase()
      .startsWith("t"),
  };
}

function runChecks() {
  const commands = [
    ["run", "typecheck", "--workspace", "@inverter/mobile"],
    ["run", "typecheck", "--workspace", "@inverter/api-client"],
    ["run", "dev:check"],
  ];

  for (const args of commands) {
    const result = spawnSync("npm", args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

function startExpo({ mode, port, launchSimulator }) {
  const extraEnv = {
    ...process.env,
    EXPO_DEV_SERVER_PORT: String(port),
  };

  const expoArgs = [];

  switch (mode) {
    case "localhost":
    case "local":
    case "sim":
      extraEnv.EXPO_USE_LOCALHOST = "1";
      extraEnv.EXPO_METRO_PORT = String(port);
      expoArgs.push("--localhost");
      break;
    case "tunnel":
      expoArgs.push("--tunnel");
      break;
    case "lan":
    default:
      expoArgs.push("--lan");
      break;
  }

  if (launchSimulator) {
    expoArgs.push("--ios");
  }

  const npmArgs = [
    "run",
    "start",
    "--workspace=@inverter/mobile",
    "--",
    ...expoArgs,
  ];

  const child = spawn("npm", npmArgs, {
    stdio: "inherit",
    env: extraEnv,
    shell: process.platform === "win32",
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

function main() {
  const config = getConfig();
  console.log(
    `[dev] Starting Expo (mode=${config.mode}, port=${config.port}, simulator=${config.launchSimulator})`
  );
  runChecks();
  startExpo(config);
}

main();
