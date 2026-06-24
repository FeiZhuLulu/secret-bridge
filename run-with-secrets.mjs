#!/usr/bin/env node
/**
 * run-with-secrets.mjs — Secret Bridge Wrapper
 *
 * Reads secrets from a local .env file and injects them as environment
 * variables into a child process. Secrets are never printed to stdout/stderr.
 *
 * Usage:
 *   node run-with-secrets.mjs -- <command>
 *   node run-with-secrets.mjs --require OPENAI_API_KEY -- <command>
 *   node run-with-secrets.mjs --require OPENAI_API_KEY,GITHUB_TOKEN -- <command>
 *   node run-with-secrets.mjs --check OPENAI_API_KEY
 */

import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Parse arguments ────────────────────────────────────────────────

const args = process.argv.slice(2);
const requiredKeys = [];
let checkMode = false;
let separatorIndex = -1;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--require") {
    const value = args[++i];
    if (!value) {
      console.error("Error: --require requires a value (KEY or KEY1,KEY2,...)");
      process.exit(1);
    }
    for (const key of value.split(",")) {
      const trimmed = key.trim();
      if (trimmed) requiredKeys.push(trimmed);
    }
  } else if (args[i] === "--check") {
    checkMode = true;
    const value = args[++i];
    if (!value) {
      console.error("Error: --check requires a value (KEY or KEY1,KEY2,...)");
      process.exit(1);
    }
    for (const key of value.split(",")) {
      const trimmed = key.trim();
      if (trimmed) requiredKeys.push(trimmed);
    }
  } else if (args[i] === "--") {
    separatorIndex = i;
    break;
  } else {
    console.error(`Error: unexpected argument '${args[i]}'`);
    console.error(
      "Usage: node run-with-secrets.mjs [--require KEY,...] [--check KEY,...] -- <command>"
    );
    process.exit(1);
  }
}

if (!checkMode && (separatorIndex === -1 || separatorIndex === args.length - 1)) {
  console.error(
    "Usage: node run-with-secrets.mjs [--require KEY,...] -- <command>"
  );
  console.error("");
  console.error("Examples:");
  console.error(
    "  node run-with-secrets.mjs -- npm run dev"
  );
  console.error(
    "  node run-with-secrets.mjs --require OPENAI_API_KEY -- node scripts/generate.js"
  );
  console.error(
    "  node run-with-secrets.mjs --require OPENAI_API_KEY,GITHUB_TOKEN -- npm run sync"
  );
  console.error(
    "  node run-with-secrets.mjs --check OPENAI_API_KEY"
  );
  process.exit(1);
}

const command = checkMode ? [] : args.slice(separatorIndex + 1);

// ── Read secrets file ──────────────────────────────────────────────

const secretsPath = resolve(__dirname, "secrets.local.env");

if (!existsSync(secretsPath)) {
  console.error("Error: secrets.local.env not found.");
  console.error(`Expected location: ${secretsPath}`);
  console.error("");
  console.error(
    "Create it by copying the template and filling in your keys:"
  );
  console.error(
    `  cp "${resolve(__dirname, "secrets.template.env")}" "${secretsPath}"`
  );
  process.exit(1);
}

let secretsContent;
try {
  secretsContent = readFileSync(secretsPath, "utf-8");
} catch (err) {
  console.error(`Error: cannot read ${secretsPath}`);
  console.error(err.message);
  process.exit(1);
}

// ── Parse KEY=VALUE pairs ──────────────────────────────────────────

const secrets = {};

for (const rawLine of secretsContent.split(/\r?\n/)) {
  const line = rawLine.trim();

  if (!line || line.startsWith("#")) continue;

  const eqIndex = line.indexOf("=");
  if (eqIndex === -1) continue;

  const key = line.slice(0, eqIndex).trim();
  const value = line.slice(eqIndex + 1).trim();

  if (!value) continue;

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    secrets[key] = value.slice(1, -1);
  } else {
    secrets[key] = value;
  }
}

// ── Validate required keys ─────────────────────────────────────────

if (requiredKeys.length > 0) {
  const missing = requiredKeys.filter(
    (key) => !secrets[key] || secrets[key].length === 0
  );

  if (missing.length > 0) {
    if (checkMode) {
      for (const key of requiredKeys) {
        if (!secrets[key] || secrets[key].length === 0) {
          console.log(`Missing: ${key}`);
        } else {
          console.log(`OK: ${key}`);
        }
      }
      process.exit(missing.length > 0 ? 1 : 0);
    }

    console.error(`Missing required secret(s): ${missing.join(", ")}`);
    console.error("");
    console.error(
      "Add them to .secret-bridge/secrets.local.env"
    );
    console.error("Example:");
    console.error(`  ${missing[0]}=your-key-here`);
    process.exit(1);
  }
}

if (checkMode) {
  for (const key of requiredKeys) {
    console.log(`OK: ${key}`);
  }
  process.exit(0);
}

// ── Spawn child process with secrets injected ──────────────────────

const childEnv = { ...process.env, ...secrets };

const isWindows = process.platform === "win32";
let spawnCommand, spawnArgs;

if (isWindows) {
  spawnCommand = "cmd";
  spawnArgs = ["/c", ...command];
} else {
  spawnCommand = command[0];
  spawnArgs = command.slice(1);
}

const child = spawn(spawnCommand, spawnArgs, {
  stdio: "inherit",
  env: childEnv,
  shell: false,
});

child.on("close", (code) => {
  process.exit(code ?? 1);
});

child.on("error", (err) => {
  console.error(`Error spawning command: ${err.message}`);
  process.exit(1);
});
