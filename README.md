# Secret Bridge

<p align="center">
  <strong>防止 API 密钥和令牌泄露到 AI 代理对话中</strong><br>
  <strong>Prevent API keys and tokens from leaking into AI agent conversations</strong>
</p>

---

## 🌐 Languages / 语言

[English](#english) | [中文](#中文)

---

<a id="english"></a>

## English

A cross-platform agent skill that prevents API keys, tokens, and other secrets from leaking into agent conversations, session logs, and debug exports.

Works with: **Kimi Code**, **Claude Code**, **Hermes**, **OpenClaw**, and any agent that reads `SKILL.md` files.

### What It Does

| Layer | Role |
|-------|------|
| **SKILL.md** | Teaches the agent the secret bridge workflow and hard rules |
| **Local .env file** | Stores secrets locally, never in conversation |
| **Wrapper script** | Reads `.env`, injects secrets into child process env |
| **Hook scripts** | (Optional) Intercepts accidental pastes and agent read attempts |
| **.gitignore** | Prevents committing secrets to version control |

### How It Works

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

### Install

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

### What Gets Generated

After setup, your project will have:

```
.secret-bridge/
├── run-with-secrets.mjs      # Wrapper script
├── block-secret-leak.mjs     # Hook script (for platforms that support it)
├── secrets.template.env      # Template (committed)
└── secrets.local.env         # Your secrets (gitignored)
```

### Usage

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

### Hooks (Optional)

Hooks provide automatic interception of accidental secret leaks. See the `hooks/` directory for platform-specific configuration:

| Platform | Config file | Where to put it |
|----------|-------------|-----------------|
| Kimi Code | `hooks/kimi-code.toml` | `~/.kimi-code/config.toml`, then `/reload` |
| Claude Code | `hooks/claude-code.json` | `.claude/settings.json` under `hooks` key |

Platforms without hook support (Hermes, OpenClaw) rely on the SKILL.md hard rules as the only defense layer.

### Security Model

- **Hooks are best-effort** — they prevent accidents, not determined exfiltration
- **This is not a sandbox** — a creative agent could bypass instructions
- **Secrets enter child process env** — that is the intended behavior
- **Goal**: keep secrets out of conversation, command text, session logs, and debug exports
- **If a secret is already in the conversation**, rotate it immediately

### Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Skill definition (agent reads this) |
| `run-with-secrets.mjs` | Wrapper: reads `.env`, injects env vars, spawns command |
| `block-secret-leak.mjs` | Hook: blocks secret pastes and env dump attempts |
| `secrets.template.env` | Template for `secrets.local.env` |
| `hooks/kimi-code.toml` | Kimi Code hook config fragment |
| `hooks/claude-code.json` | Claude Code hook config fragment |

---

<a id="中文"></a>

## 中文

一个跨平台的 AI 代理技能，防止 API 密钥、令牌和其他敏感信息泄露到代理对话、会话日志和调试导出中。

支持：**Kimi Code**、**Claude Code**、**Hermes**、**OpenClaw** 以及任何读取 `SKILL.md` 文件的代理。

### 功能说明

| 层级 | 作用 |
|------|------|
| **SKILL.md** | 教会代理 Secret Bridge 的工作流程和严格规则 |
| **本地 .env 文件** | 在本地存储密钥，永远不会出现在对话中 |
| **包装脚本** | 读取 `.env`，将密钥注入子进程环境变量 |
| **钩子脚本** | （可选）拦截意外粘贴和代理读取尝试 |
| **.gitignore** | 防止密钥被提交到版本控制系统 |

### 工作原理

```
之前（不安全）：
  用户："这是我的密钥：sk-abc123..."
  代理：[密钥进入对话、会话日志、调试导出]

之后（使用 Secret Bridge）：
  用户："我需要 OPENAI_API_KEY"
  代理："请在 .secret-bridge/secrets.local.env 中填写"
  代理：node .secret-bridge/run-with-secrets.mjs --require OPENAI_API_KEY -- npm run dev
  [密钥仅存在于本地 .env 和子进程环境变量中]
```

### 安装

将此目录复制到代理的技能位置：

| 平台 | 技能目录 | 命令 |
|------|---------|------|
| **Kimi Code** | `~/.kimi-code/skills/`（用户级）或 `.kimi-code/skills/`（项目级） | `cp -r secret-bridge ~/.kimi-code/skills/` |
| **Claude Code** | `~/.claude/skills/`（用户级）或 `.claude/skills/`（项目级） | `cp -r secret-bridge ~/.claude/skills/` |
| **Hermes** | `~/.hermes/skills/` | `cp -r secret-bridge ~/.hermes/skills/` |
| **OpenClaw** | `~/.agents/skills/`（用户级）或 `.agents/skills/`（项目级） | `cp -r secret-bridge ~/.agents/skills/` |

然后在代理中调用：

```
/skill:secret-bridge
```

### 生成的文件

设置完成后，你的项目将包含：

```
.secret-bridge/
├── run-with-secrets.mjs      # 包装脚本
├── block-secret-leak.mjs     # 钩子脚本（用于支持的平台）
├── secrets.template.env      # 模板文件（提交到版本控制）
└── secrets.local.env         # 你的密钥（已 gitignore）
```

### 使用方法

```bash
# 使用所有已填写的密钥运行
node .secret-bridge/run-with-secrets.mjs -- npm run dev

# 要求特定密钥（运行前验证）
node .secret-bridge/run-with-secrets.mjs --require OPENAI_API_KEY -- node scripts/generate.js

# 多个必需密钥
node .secret-bridge/run-with-secrets.mjs --require OPENAI_API_KEY,GITHUB_TOKEN -- npm run sync

# 检查密钥是否已填写（不启动子进程）
node .secret-bridge/run-with-secrets.mjs --check OPENAI_API_KEY
```

### 钩子（可选）

钩子提供自动拦截意外密钥泄露的功能。参见 `hooks/` 目录获取平台特定配置：

| 平台 | 配置文件 | 放置位置 |
|------|---------|---------|
| Kimi Code | `hooks/kimi-code.toml` | `~/.kimi-code/config.toml`，然后执行 `/reload` |
| Claude Code | `hooks/claude-code.json` | `.claude/settings.json` 中的 `hooks` 键 |

不支持钩子的平台（Hermes、OpenClaw）依赖 SKILL.md 中的严格规则作为唯一的防护层。

### 安全模型

- **钩子是尽力而为的** — 它们防止意外泄露，而非蓄意攻击
- **这不是沙箱** — 有创造力的代理可能绕过指令
- **密钥进入子进程环境变量** — 这是预期行为
- **目标**：将密钥排除在对话、命令文本、会话日志和调试导出之外
- **如果密钥已经出现在对话中**，请立即轮换（重新生成）

### 文件说明

| 文件 | 用途 |
|------|------|
| `SKILL.md` | 技能定义（代理读取此文件） |
| `run-with-secrets.mjs` | 包装器：读取 `.env`，注入环境变量，启动命令 |
| `block-secret-leak.mjs` | 钩子：阻止密钥粘贴和环境变量转储 |
| `secrets.template.env` | `secrets.local.env` 的模板文件 |
| `hooks/kimi-code.toml` | Kimi Code 钩子配置片段 |
| `hooks/claude-code.json` | Claude Code 钩子配置片段 |

---

## 📄 License / 许可证

MIT

## 🤝 Contributing / 贡献

Contributions are welcome! / 欢迎贡献！

## ⭐ Star History / 星标历史

If you find this useful, give it a star! / 如果觉得有用，请点个星！
