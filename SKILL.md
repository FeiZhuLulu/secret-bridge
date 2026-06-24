---
name: secret-bridge
description: Prevent API keys, tokens, and secrets from leaking into agent conversations and logs. Sets up a local .env file and wrapper script for safe secret injection into child processes.
type: prompt
whenToUse: When a task requires API keys, access tokens, private keys, cloud credentials, GitHub tokens, OpenAI/Anthropic/HuggingFace tokens, or when the user tries to paste a secret into the conversation
---

# Secret Bridge

## Purpose

When a task requires API keys, tokens, or other secrets, set up a local secret bridge so that:

- Secrets live in a local `.env` file, never in the conversation
- Commands run through a wrapper that injects secrets as environment variables
- Secrets never appear in conversation history, command text, session logs, or debug exports

**Security goal**: Prevent secrets from entering the conversation, command text, session records, and accidental tool output.

**This does NOT**: make secrets invisible to local processes. The wrapper injects them into the child process environment — that is the intended behavior.

## Hard Rules

These rules are absolute. There is no exception.

1. **Never paste, type, or output secret values.** No API keys, tokens, private keys, cookies, or session tokens in the conversation.
2. **Never read `.secret-bridge/secrets.local.env`.** Do not use `cat`, `Read`, `Grep`, `head`, `tail`, `less`, `more`, or any tool to read its contents.
3. **Never use `ENV_VAR=value command` for secrets.** The command text itself may be logged.
4. **Never print secret values.** No `echo $SECRET`, no `console.log(process.env)`, no `env`, no `printenv`.
5. **Only inject secrets through the wrapper.** `node .secret-bridge/run-with-secrets.mjs -- <command>`
6. **Never suggest the user paste secrets here.** Always direct them to edit `secrets.local.env` in their own editor.
7. **If a secret is already in the conversation**, immediately tell the user to rotate it.

## First-Time Setup

When the project does not have `.secret-bridge/` yet:

### 1. Create the bridge directory

```bash
mkdir -p .secret-bridge
```

### 2. Copy scripts from the skill directory

Copy `run-with-secrets.mjs`, `block-secret-leak.mjs`, and `secrets.template.env` from this skill's directory to `.secret-bridge/`.

The skill directory location varies by platform. Find it by looking at where this `SKILL.md` file is stored, then copy the companion files from the same directory.

### 3. Create the local secrets file

```bash
cp .secret-bridge/secrets.template.env .secret-bridge/secrets.local.env
chmod 600 .secret-bridge/secrets.local.env
```

Tell the user:

> Your secret file is at `.secret-bridge/secrets.local.env`.
> Open it in your editor and fill in the keys you need. Do NOT paste them here.

### 4. Update .gitignore

Check if `.gitignore` already contains the secret bridge entries. If not, append:

```
# Secret Bridge
.secret-bridge/secrets.local.env
.secret-bridge/*.local.env
.secret-bridge/*.local.md
```

### 5. (Optional) Configure hooks

If your platform supports hooks, see the `hooks/` directory in this skill for platform-specific configuration. Hooks provide automatic interception of accidental secret pastes and agent read attempts. Without hooks, the Hard Rules above are your only defense.

## Using the Bridge

Once setup is complete, when a task needs a secret:

### 1. Identify the required variable

Tell the user which variable name is needed. Never mention or show the value.

> This task requires `OPENAI_API_KEY`.

### 2. Check if it's filled

```bash
node .secret-bridge/run-with-secrets.mjs --check OPENAI_API_KEY
```

This reports `OK: OPENAI_API_KEY` or `Missing: OPENAI_API_KEY` without revealing the value.

If missing, tell the user:

> `OPENAI_API_KEY` is not set in `.secret-bridge/secrets.local.env`.
> Please fill it in, then tell me to proceed.

### 3. Run through the wrapper

```bash
node .secret-bridge/run-with-secrets.mjs --require OPENAI_API_KEY -- <your command>
```

Multiple required keys:

```bash
node .secret-bridge/run-with-secrets.mjs --require OPENAI_API_KEY,GITHUB_TOKEN -- <your command>
```

No specific requirement (load all filled keys):

```bash
node .secret-bridge/run-with-secrets.mjs -- <your command>
```

## Wrapper Reference

`run-with-secrets.mjs` lives at `.secret-bridge/run-with-secrets.mjs` in the project.

| Usage | Description |
|-------|-------------|
| `--require KEY` | Validate that KEY exists and is non-empty. Multiple `--require` or comma-separated. |
| `--check KEY` | Check if KEY is filled. Prints `OK: KEY` or `Missing: KEY`. No child process. |
| `-- <command>` | Everything after `--` is the command to run. |

Behavior:

- Reads `.secret-bridge/secrets.local.env`
- Parses `KEY=VALUE` (skips `#` comments, empty lines, empty values)
- Merges into the child process environment
- Never prints secret values
- Missing required keys: prints `Missing: KEY` (name only), exits 1
- File not found: prints error with setup instructions, exits 1
- Windows compatible: uses `cmd /c` for `.cmd`/`.ps1` scripts

## Hooks (Optional Enhancement)

Hooks automatically intercept accidental secret leaks. They are an enhancement, not a requirement. Without hooks, the Hard Rules above are your only defense.

### Available hook scripts

`block-secret-leak.mjs` provides two modes:

**user-prompt mode**: Intercepts user input before it reaches the model. Blocks if it detects high-confidence token prefixes (`sk-`, `ghp_`, `hf_`, `AKIA`, `AIza`, private keys, JWTs).

**pre-tool-use mode**: Intercepts Bash commands before execution. Blocks reading `secrets.local.env`, dumping env vars, and commands containing token values.

### Platform-specific setup

See the `hooks/` directory in this skill for configuration fragments:

| Platform | Hook file | Notes |
|----------|-----------|-------|
| Kimi Code | `hooks/kimi-code.toml` | Add to `~/.kimi-code/config.toml`, then `/reload` |
| Claude Code | `hooks/claude-code.json` | Merge into `.claude/settings.json` |
| Hermes | N/A | No hook system. Rely on Hard Rules. |
| OpenClaw | N/A | No hook system. Rely on Hard Rules. |

For platforms without hooks, consider adding the Hard Rules to your `AGENTS.md` or equivalent instruction file.

## Security Model

- **Hooks are best-effort.** On platforms that support them, hooks are fail-open (script error/timeout = allow). They prevent accidents, not determined exfiltration.
- **This is not a sandbox.** A sufficiently creative agent could bypass instructions. This skill reduces risk, it does not eliminate it.
- **Secrets enter the child process env.** The target command can read `process.env.OPENAI_API_KEY` — that is expected, not a vulnerability.
- **Session persistence.** Many agents store session data locally. This skill prevents secrets from entering those logs, but if a secret was already shared before setup, it may be in existing session data.
- **If a secret is already compromised**, rotate it immediately. This skill cannot un-leak what's already been shared.
