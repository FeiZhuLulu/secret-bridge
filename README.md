# secret-bridge

A cross-platform agent skill that prevents API keys, tokens, and other secrets from leaking into agent conversations, session logs, and debug exports.

Works with: **Kimi Code**, **Claude Code**, **Hermes**, **OpenClaw**, and any agent that reads `SKILL.md` files.

## What It Does

| Layer | Role |
|-------|------|
| **SKILL.md** | Teaches the agent the secret bridge workflow and hard rules |
| **Local .env file** | Stores secrets locally, never in conversation |
| **Wrapper script** | Reads `.env`, injects secrets into child process env |
| **Hook scripts** | (Optional) Intercepts accidental pastes and agent read attempts |
| **.gitignore** | Prevents committing secrets to version control |

## How It Works

```
Before (insecure):
  User: "Here's my key: sk-abc123..."
  Agent: [key enters conversation, session logs, debug export]

After (with secret bridge):
  User: "I need OPENAI_API_KEY"
  Agent: "Fill it in .secret-bridge/secrets.local.env"
  Agent: node .secret-bridge/run-with-secrets.mjs --require OPENAI_API_KEY -- npm run dev
  [key only exists in local .env and child process env]
```

## Install

Copy this directory to your agent's skill location:

| Platform | Skill directory | Command |
|----------|----------------|---------|
| **Kimi Code** | `~/.kimi-code/skills/` (user) or `.kimi-code/skills/` (project) | `cp -r secret-bridge ~/.kimi-code/skills/` |
| **Claude Code** | `~/.claude/skills/` (user) or `.claude/skills/` (project) | `cp -r secret-bridge ~/.claude/skills/` |
| **Hermes** | `~/.hermes/skills/` | `cp -r secret-bridge ~/.hermes/skills/` |
| **OpenClaw** | `~/.agents/skills/` (user) or `.agents/skills/` (project) | `cp -r secret-bridge ~/.agents/skills/` |

Then invoke in your agent:

```
/skill:secret-bridge
```

## What Gets Generated

After setup, your project will have:

```
.secret-bridge/
├── run-with-secrets.mjs      # Wrapper script
├── block-secret-leak.mjs     # Hook script (for platforms that support it)
├── secrets.template.env      # Template (committed)
└── secrets.local.env         # Your secrets (gitignored)
```

## Usage

```bash
# Run with all filled secrets
node .secret-bridge/run-with-secrets.mjs -- npm run dev

# Require specific keys (validates before running)
node .secret-bridge/run-with-secrets.mjs --require OPENAI_API_KEY -- node scripts/generate.js

# Multiple required keys
node .secret-bridge/run-with-secrets.mjs --require OPENAI_API_KEY,GITHUB_TOKEN -- npm run sync

# Check if a key is filled (no child process)
node .secret-bridge/run-with-secrets.mjs --check OPENAI_API_KEY
```

## Hooks (Optional)

Hooks provide automatic interception of accidental secret leaks. See the `hooks/` directory for platform-specific configuration:

| Platform | Config file | Where to put it |
|----------|-------------|-----------------|
| Kimi Code | `hooks/kimi-code.toml` | `~/.kimi-code/config.toml`, then `/reload` |
| Claude Code | `hooks/claude-code.json` | `.claude/settings.json` under `hooks` key |

Platforms without hook support (Hermes, OpenClaw) rely on the SKILL.md hard rules as the only defense layer.

## Security Model

- **Hooks are best-effort** — they prevent accidents, not determined exfiltration
- **This is not a sandbox** — a creative agent could bypass instructions
- **Secrets enter child process env** — that is the intended behavior
- **Goal**: keep secrets out of conversation, command text, session logs, and debug exports
- **If a secret is already in the conversation**, rotate it immediately

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Skill definition (agent reads this) |
| `run-with-secrets.mjs` | Wrapper: reads `.env`, injects env vars, spawns command |
| `block-secret-leak.mjs` | Hook: blocks secret pastes and env dump attempts |
| `secrets.template.env` | Template for `secrets.local.env` |
| `hooks/kimi-code.toml` | Kimi Code hook config fragment |
| `hooks/claude-code.json` | Claude Code hook config fragment |
