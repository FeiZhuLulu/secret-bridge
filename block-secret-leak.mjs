#!/usr/bin/env node
/**
 * block-secret-leak.mjs — Secret Bridge Hook
 *
 * Two modes:
 *   user-prompt     — blocks user from pasting API keys/tokens into conversation
 *   pre-tool-use    — blocks agent from reading secret files or dumping env vars
 *
 * Exit codes (hook convention):
 *   0 = allow
 *   2 = block
 *
 * stdin: JSON payload from hook system (snake_case fields)
 */

import { readFileSync } from "node:fs";

const mode = process.argv[2];

if (!mode || !["user-prompt", "pre-tool-use"].includes(mode)) {
  console.error("Usage: node block-secret-leak.mjs <user-prompt|pre-tool-use>");
  process.exit(0); // fail-open
}

// ── Read stdin ─────────────────────────────────────────────────────

let input = "";
try {
  input = readFileSync(0, "utf-8");
} catch {
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(input || "{}");
} catch {
  process.exit(0);
}

// ── High-confidence token prefixes ─────────────────────────────────

const TOKEN_PATTERNS = [
  { pattern: /sk-[A-Za-z0-9_-]{10,}/, label: "OpenAI API key" },
  { pattern: /sk-proj-[A-Za-z0-9_-]{10,}/, label: "OpenAI project key" },
  { pattern: /sk-svcacct-[A-Za-z0-9_-]{10,}/, label: "OpenAI service account key" },
  { pattern: /ghp_[A-Za-z0-9]{10,}/, label: "GitHub personal access token" },
  { pattern: /github_pat_[A-Za-z0-9_]{10,}/, label: "GitHub fine-grained token" },
  { pattern: /hf_[A-Za-z0-9]{10,}/, label: "HuggingFace token" },
  { pattern: /xoxb-[A-Za-z0-9-]{10,}/, label: "Slack bot token" },
  { pattern: /xoxp-[A-Za-z0-9-]{10,}/, label: "Slack user token" },
  { pattern: /AKIA[A-Z0-9]{16}/, label: "AWS access key ID" },
  { pattern: /AIza[A-Za-z0-9_-]{30,}/, label: "Google API key" },
  { pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, label: "Private key" },
  { pattern: /Bearer eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, label: "JWT bearer token" },
];

function detectToken(text) {
  for (const { pattern, label } of TOKEN_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}

// ── Mode A: user-prompt ────────────────────────────────────────────

function handleUserPrompt() {
  const text =
    payload.prompt ??
    payload.user_prompt ??
    payload.message ??
    payload.input ??
    "";

  if (!text || typeof text !== "string") {
    process.exit(0);
  }

  const detected = detectToken(text);
  if (detected) {
    console.error(
      `[Secret Bridge] Blocked: detected ${detected} in your message.`
    );
    console.error(
      "Do not paste secrets into the conversation."
    );
    console.error(
      "Write them to .secret-bridge/secrets.local.env instead."
    );
    console.error(
      "If this key was already shared, rotate it immediately."
    );
    process.exit(2);
  }

  process.exit(0);
}

// ── Mode B: pre-tool-use ───────────────────────────────────────────

function handlePreToolUse() {
  const command = payload.tool_input?.command ?? "";

  if (!command || typeof command !== "string") {
    process.exit(0);
  }

  // Extract commands to check: the full command + sub-command after wrapper's --
  const commandsToCheck = [command];

  const wrapperMatch = command.match(
    /\brun-with-secrets\.mjs\b[\s\S]*?\s--\s+([\s\S]+)$/
  );
  if (wrapperMatch) {
    commandsToCheck.push(wrapperMatch[1]);
  }

  if (
    /\brun-with-secrets\.mjs\b/.test(command) &&
    !wrapperMatch
  ) {
    process.exit(0);
  }

  function blockWith(msg) {
    console.error(`[Secret Bridge] Blocked: ${msg}`);
    console.error(
      "Use the wrapper: node .secret-bridge/run-with-secrets.mjs -- <command>"
    );
    process.exit(2);
  }

  // ── Block: reading secret files ──

  const SECRET_FILE_READ_PATTERNS = [
    /\bcat\b.*secrets\.local\.env/,
    /\bless\b.*secrets\.local\.env/,
    /\bmore\b.*secrets\.local\.env/,
    /\bhead\b.*secrets\.local\.env/,
    /\btail\b.*secrets\.local\.env/,
    /\bgrep\b.*secrets\.local\.env/,
    /\brg\b.*secrets\.local\.env/,
    /\bag\b.*secrets\.local\.env/,
    /\bsed\b.*secrets\.local\.env/,
    /\bawk\b.*secrets\.local\.env/,
  ];

  for (const cmd of commandsToCheck) {
    for (const pattern of SECRET_FILE_READ_PATTERNS) {
      if (pattern.test(cmd)) {
        blockWith("do not read secret files directly.");
      }
    }
  }

  // ── Block: dumping all environment variables ──

  const ENV_DUMP_PATTERNS = [
    /^\s*env\s*$/,
    /^\s*printenv\s*$/,
    /^\s*env\s*[;|&]/,
    /^\s*printenv\s*[;|&]/,
    /\bprintenv\s+[A-Z_]+/,
    /\becho\s+\$[A-Z_]*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)/i,
    /process\.env\b/,
    /os\.environ/,
  ];

  for (const cmd of commandsToCheck) {
    for (const pattern of ENV_DUMP_PATTERNS) {
      if (pattern.test(cmd)) {
        blockWith("environment variable dump is not allowed.");
      }
    }
  }

  // ── Block: ENV=value with sensitive variable name + known token prefix ──

  const SENSITIVE_VAR_PATTERN =
    /\b([A-Z_]*(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTHORIZATION)[A-Z_]*)=(\S+)/gi;

  for (const cmd of commandsToCheck) {
    let match;
    SENSITIVE_VAR_PATTERN.lastIndex = 0;
    while ((match = SENSITIVE_VAR_PATTERN.exec(cmd)) !== null) {
      const value = match[3];
      if (detectToken(value)) {
        blockWith(`secret value detected in command for ${match[1]}.`);
      }
    }
  }

  // ── Block: known token prefixes appearing directly in command ──

  for (const cmd of commandsToCheck) {
    const directToken = detectToken(cmd);
    if (directToken) {
      blockWith(`${directToken} detected in command text.`);
    }
  }

  process.exit(0);
}

// ── Dispatch ───────────────────────────────────────────────────────

if (mode === "user-prompt") {
  handleUserPrompt();
} else {
  handlePreToolUse();
}
