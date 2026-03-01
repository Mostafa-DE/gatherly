# Plan: Customize OpenClaw Railway Template for Gatherly

## Context

Gatherly needs a Telegram-based AI assistant that lets org admins issue voice/text commands (mark attendance, record matches) via Telegram. The backend is fully built (`src/plugins/assistant/`). The missing piece is deploying a hardened, Gatherly-branded OpenClaw instance alongside the main app.

**What exists today:**
- `src/plugins/assistant/router.ts` — Full bot API (1073 lines)
- `skills/gatherly-command-gateway/SKILL.md` — OpenClaw skill definition
- `skills/gatherly-command-gateway/references/api.md` — API reference
- `docs/openclaw-gatherly-plan.md` — Architecture plan

**What we're building:** A customized, security-hardened OpenClaw Railway template at `infra/openclaw-template/` inside the Gatherly monorepo.

---

## Security Decisions

| Setting | Value | Rationale |
|---------|-------|-----------|
| DM Policy | `allowlist` | Only linked Telegram admins can talk to the bot |
| Group Policy | `disabled` | DMs only, no group chats |
| Session Scope | `per-channel-peer` | Each admin gets isolated conversation context |
| Bundled Skills | `[]` (none) | Only the Gatherly skill runs |
| Tools Denied | `group:automation`, `group:fs`, `group:ui`, `group:web`, `sessions_spawn`, `sessions_send`, `process` | Minimal attack surface |
| Exec | `allowlist` mode | Allows curl for API calls, blocks everything else |
| Elevated | `disabled` | No host escape |
| Sandbox | Off (tool deny-list approach) | Railway doesn't support Docker-in-Docker easily |
| Multi-tenancy | Single shared instance | Bot API key + Telegram identity link scopes to correct org |
| AI Provider | OpenAI Codex OAuth | Manual post-deploy via `openclaw models auth login --provider openai-codex --set-default` |
| Bot Token | Same Telegram bot for both OpenClaw and Gatherly | Shared identity |

---

## Deployment Architecture

```
Railway Project
├── Gatherly (main app)
│   ├── Service: TanStack Start + Nitro
│   ├── Database: PostgreSQL (Railway volume)
│   └── Env: DATABASE_URL, BETTER_AUTH_*, TELEGRAM_BOT_TOKEN
│
└── Gatherly Assistant (customized OpenClaw template)
    ├── Service: OpenClaw Gateway + Express wrapper
    ├── Volume: /data (config + skills + credentials)
    └── Env: SETUP_PASSWORD, GATHERLY_BASE_URL, GATHERLY_BOT_API_KEY
```

**Connectivity:**
- OpenClaw calls Gatherly via `GATHERLY_BASE_URL` (Railway internal networking or public URL)
- Telegram webhooks → OpenClaw → parses intent → calls Gatherly tRPC
- Both services share the same Telegram bot token

---

## Implementation Steps

### Step 1: Copy Template into Monorepo

Copy `~/code/openclaw-railway-template/` to `infra/openclaw-template/`, excluding `.git/`, `.github/`, `CONTRIBUTING.md`, `CLAUDE.md`, `docs/`.

**Final directory structure:**
```
infra/openclaw-template/
├── Dockerfile
├── entrypoint.sh
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── railway.toml
├── .env.example
├── .gitignore
├── .mise.toml
├── LICENSE
├── README.md              ← rewrite for Gatherly
├── config/
│   └── openclaw-base.json ← NEW: hardened security config
├── skills/
│   └── gatherly-command-gateway/  ← copy from repo root skills/
│       ├── SKILL.md
│       └── references/api.md
└── src/
    ├── server.js          ← modify
    └── public/
        ├── setup.html     ← modify (rebrand + simplify)
        ├── loading.html   ← modify (rebrand)
        └── tui.html       ← minor rebrand
```

**Note:** We duplicate the skill files into `infra/openclaw-template/skills/` to keep the Docker build context self-contained. This avoids complex monorepo Docker context issues with Railway.

---

### Step 2: Create Hardened Base Config

**New file:** `infra/openclaw-template/config/openclaw-base.json`

```json
{
  "session": {
    "dmScope": "per-channel-peer",
    "reset": { "mode": "daily", "atHour": 4 }
  },
  "tools": {
    "profile": "messaging",
    "deny": [
      "group:automation",
      "group:fs",
      "group:ui",
      "group:web",
      "sessions_spawn",
      "sessions_send",
      "process"
    ],
    "exec": {
      "security": "allowlist"
    },
    "elevated": { "enabled": false },
    "fs": { "workspaceOnly": true }
  },
  "skills": {
    "allowBundled": [],
    "load": {
      "extraDirs": ["/openclaw-skills"]
    }
  },
  "channels": {
    "telegram": {
      "dmPolicy": "allowlist",
      "groupPolicy": "disabled"
    }
  }
}
```

**Key design choice on exec:** We use `"allowlist"` instead of `"deny"` because the Gatherly skill needs `curl` to call Gatherly's tRPC API. The `process` tool is explicitly denied. All other dangerous tool groups (`fs`, `automation`, `ui`, `web`) are blocked.

---

### Step 3: Modify Dockerfile

**File:** `infra/openclaw-template/Dockerfile`

Changes after line 98 (`COPY --from=openclaw-build /openclaw /openclaw`):

```dockerfile
# Copy Gatherly skill and hardened config
RUN mkdir -p /openclaw-skills
COPY skills/gatherly-command-gateway /openclaw-skills/gatherly-command-gateway
COPY config/openclaw-base.json /app/config/openclaw-base.json
```

After the `openclaw` user creation (line 111), add ownership:

```dockerfile
RUN chown -R openclaw:openclaw /openclaw-skills
```

---

### Step 4: Modify `server.js`

**File:** `infra/openclaw-template/src/server.js`

#### 4a. Add Gatherly env var declarations (after line 20)

```javascript
const GATHERLY_BASE_URL = process.env.GATHERLY_BASE_URL?.trim();
const GATHERLY_BOT_API_KEY = process.env.GATHERLY_BOT_API_KEY?.trim();
if (!GATHERLY_BASE_URL) console.warn("[warn] GATHERLY_BASE_URL not set");
if (!GATHERLY_BOT_API_KEY) console.warn("[warn] GATHERLY_BOT_API_KEY not set");
```

#### 4b. Pass Gatherly env vars to gateway process (line ~208)

Add to the `env` object in `startGateway()`:

```javascript
GATHERLY_BASE_URL: process.env.GATHERLY_BASE_URL || "",
GATHERLY_BOT_API_KEY: process.env.GATHERLY_BOT_API_KEY || "",
```

Same for `runCmd()` (~line 599) and TUI PTY spawn (~line 885).

#### 4c. Inject hardened config during onboarding (after line 733, inside `if (ok) {}`)

After the `trustedProxies` config set, merge the base config:

```javascript
// Apply hardened Gatherly security config
const baseConfigPath = path.join(process.cwd(), "config", "openclaw-base.json");
if (fs.existsSync(baseConfigPath)) {
  const baseConfig = JSON.parse(fs.readFileSync(baseConfigPath, "utf8"));
  for (const [key, value] of Object.entries(baseConfig)) {
    const r = await runCmd(OPENCLAW_NODE, clawArgs(["config", "set", "--json", key, JSON.stringify(value)]));
    extra += `[config] ${key} exit=${r.code}\n`;
  }
}
```

#### 4d. Harden Telegram channel config (line 765-773)

Force allowlist/disabled policies regardless of wizard input:

```javascript
if (payload.telegramToken?.trim()) {
  extra += await configureChannel("telegram", {
    enabled: true,
    dmPolicy: "allowlist",
    botToken: payload.telegramToken.trim(),
    groupPolicy: "disabled",
    streamMode: "partial",
  });
}
```

#### 4e. Remove Discord/Slack channel setup (lines 775-790)

Delete the Discord and Slack `configureChannel` blocks entirely.

#### 4f. Clean up payload validation (line 648)

Remove `"discordToken"`, `"slackBotToken"`, `"slackAppToken"` from `stringFields`.

#### 4g. Add Gatherly API key redaction (line 809)

Add to `redactSecrets()`:
```javascript
.replace(/(gat_[A-Za-z0-9_-]{10,})/g, "[REDACTED]")
```

---

### Step 5: Customize Setup Wizard UI

**File:** `infra/openclaw-template/src/public/setup.html`

#### 5a. Branding changes
- Title: `"Gatherly Assistant Setup"` (line 6)
- Replace OpenClaw logo `<picture>` (lines 230-233) with text header: `"Gatherly Assistant"`
- Heading: `"Gatherly Assistant"` (line 235)
- Subtitle: `"Configure your Gatherly AI assistant for Telegram"` (line 236)
- Status label: `"Gatherly Assistant"` instead of `"OpenClaw"` (line 241)
- Link text: `"Open Control Panel"` (line 248)
- Post-setup heading: `"Your Gatherly Assistant is configured and running"` (line 261)

#### 5b. Simplify to 2 steps (was 3)
- Change `totalSteps: 3` → `totalSteps: 2` (line 21)
- Remove `discordToken`, `slackBotToken`, `slackAppToken` data properties (lines 32-34)
- Remove them from `runSetup()` payload (lines 108-110)

#### 5c. Merge Step 1 (Auth) + Step 2 (Channels) into single Step 1
- Move Telegram token input from Step 2 into Step 1 (after model input)
- Delete entire Discord section (lines 391-400)
- Delete entire Slack section (lines 402-413)
- Current Step 3 (Run Setup) becomes Step 2

#### 5d. Simplify configuration summary
- Remove Discord/Slack badges from summary (lines 442-444)
- Only show Telegram badge

#### 5e. Simplify pairing modal
- Remove channel dropdown (lines 498-503), hardcode to `"telegram"`
- Remove Discord from `approvePairing()` validation (line 143)

#### 5f. Color theme (Gatherly teal)
- Replace `bg-red-600`/`hover:bg-red-700` → `bg-teal-600`/`hover:bg-teal-700` for primary buttons
- Replace `focus:border-red-500` → `focus:border-teal-500` for inputs
- Step indicators: `bg-red-600` → `bg-teal-600` (line 318)

---

### Step 6: Rebrand Loading & TUI Pages

**`loading.html`:** Change title to "Gatherly Assistant — Starting", heading to "Gatherly Assistant is starting"

**`tui.html`:** Change title to "Gatherly Assistant Terminal"

---

### Step 7: Update `railway.toml`

```toml
[build]
builder = "dockerfile"

[deploy]
healthcheckPath = "/setup/healthz"
healthcheckTimeout = 300
restartPolicyType = "on_failure"

[variables]
PORT = "8080"
```

Railway service root directory should be set to `infra/openclaw-template/` in Railway's dashboard. `GATHERLY_BASE_URL`, `GATHERLY_BOT_API_KEY`, and `SETUP_PASSWORD` are set as Railway secrets (not committed to file).

---

### Step 8: Update `.env.example`

Add to the file:

```bash
# GATHERLY (REQUIRED)
GATHERLY_BASE_URL=https://your-gatherly-instance.com
GATHERLY_BOT_API_KEY=gat_your-api-key-here

# TELEGRAM (REQUIRED — same bot token used by both OpenClaw and Gatherly)
TELEGRAM_BOT_TOKEN=
```

---

### Step 9: Rewrite `README.md`

Replace with Gatherly-specific docs covering:
- What this is (hardened OpenClaw instance for Gatherly's Telegram assistant)
- Prerequisites (Gatherly bot API key from dashboard, Telegram bot token from @BotFather)
- Railway deployment steps
- Environment variables reference
- Post-deploy setup: `openclaw models auth login --provider openai-codex --set-default`
- Security overview (what is locked down and why)
- Troubleshooting

---

## OpenClaw Session & Security Reference

### Session Isolation (`per-channel-peer`)

Each Telegram admin gets their own isolated session keyed as `agent:<agentId>:telegram:dm:<telegramUserId>`. No conversation context is shared between admins. Sessions reset daily at 4 AM.

### Tool Policy (deny list + exec allowlist)

| Tool Group | Status | Reason |
|------------|--------|--------|
| `group:automation` | DENIED | No cron jobs or gateway management |
| `group:fs` | DENIED | No file read/write/edit access |
| `group:ui` | DENIED | No browser or canvas |
| `group:web` | DENIED | No web_search or web_fetch (skill uses curl) |
| `process` | DENIED | No process management |
| `sessions_spawn` | DENIED | No sub-session spawning |
| `sessions_send` | DENIED | No cross-session messaging |
| `exec` | ALLOWLIST | Only approved commands (curl for API calls) |
| `group:messaging` | ALLOWED | Core messaging functionality |

### DM Access Control

- `dmPolicy: "allowlist"` — Only Telegram users who have linked their account via the Gatherly dashboard can message the bot
- `groupPolicy: "disabled"` — Bot ignores all group chat messages
- Unknown senders are silently dropped

### What the Agent Can Do

1. Receive Telegram DMs from linked admins
2. Read the Gatherly SKILL.md instructions
3. Execute `curl` commands to call Gatherly's tRPC API endpoints
4. Send Telegram messages back to the admin
5. Nothing else — no filesystem, no web browsing, no other tools

---

## Verification Plan

1. **Docker build:** `docker build -t gatherly-assistant infra/openclaw-template/` — should succeed
2. **Local run:** Start container with test env vars, visit `localhost:8080/setup`, verify Gatherly-branded UI
3. **Setup wizard:** Complete 2-step setup with Telegram token, verify hardened config applied
4. **Config verification:** Exec into container, check `/data/.openclaw/openclaw.json` has all hardened settings
5. **Skill loaded:** Verify `/openclaw-skills/gatherly-command-gateway/SKILL.md` exists in container
6. **Security audit:** Run `openclaw security audit` inside container
7. **End-to-end:** Deploy to Railway → link Telegram via Gatherly dashboard → send test command → verify approval flow works

---

## Open Items / Follow-ups

1. **Exec allowlist for curl:** Verify that `exec.security: "allowlist"` permits curl commands from the skill without manual approval in a messaging context. If it prompts for approval on first use, adjust to use OpenClaw's `safeBins` config or pre-approve curl.
2. **Skill sync:** The skill files are duplicated in `infra/openclaw-template/skills/`. If the skill changes, both copies need updating. Consider a build script if this becomes a maintenance burden.
3. **Multi-org routing:** Single instance serves all orgs. The `botProcedure` + Telegram identity link already scopes commands to the correct org at the Gatherly level.
4. **Expand skills (future):** Add read-only query skills (member lookup, session info, analytics summaries) after MVP validation.
5. **Phase 2 commands:** `create_session` action (from `docs/openclaw-gatherly-plan.md`) not yet implemented in the backend.
