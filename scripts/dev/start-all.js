#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

function run(command, args, env) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  const env = { ...process.env };
  if (!env.EXPO_AUTO_START_API) {
    env.EXPO_AUTO_START_API = "true";
  }

  const ensureScript = path.resolve(__dirname, "ensure-api.js");
  run(process.execPath, [ensureScript], env);

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  run(npmCmd, ["run", "dev:start"], env);
}

main();
