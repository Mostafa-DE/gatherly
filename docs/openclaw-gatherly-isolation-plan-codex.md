# Gatherly-Specific OpenClaw Isolation Plan (Railway)

## Summary
Deploy OpenClaw as a separate Railway service (same project/environment as Gatherly) with strict trust-boundary isolation, private-only service-to-service traffic, and command-session hardening based on OpenClaw session/security guidance.

Locked decisions from discussion:
- Topology: separate service
- Exposure: only `/openclaw` public after onboarding; `/setup` and admin APIs private
- Tenant model: one gateway per environment
- Session scope: `per-channel-peer`
- Gatherly API path: Railway private DNS only
- Write safety: all writes require explicit approval
- Session retention: 24h inactivity TTL (idle reset via `session.reset.idleMinutes: 1440`)

References used:
- https://docs.openclaw.ai/concepts/session
- https://docs.openclaw.ai/security-model

## Important API / Interface Changes

### 1) OpenClaw wrapper env contract
Add and enforce:
- `GATHERLY_BASE_URL` (must be internal Railway DNS URL, e.g. `http://web.railway.internal:8080`)
- `GATHERLY_BOT_API_KEY`
- Session config applied via `openclaw-base.json` (not env vars — see Section 4)

Behavior:
- wrapper fails fast at startup if `GATHERLY_BASE_URL` is public URL in production
- wrapper health endpoint reports integration readiness (without secrets)

### 2) Admin surface partitioning
- Keep `/openclaw` public
- Move `/setup`, `/setup/api/*`, debug/doctor/export/reset endpoints behind private access mode
- Add `OPENCLAW_SETUP_ENABLED=false` default for production after onboarding
- Optional temporary enable switch for controlled maintenance window

### 3) Gatherly integration contract (no fuzzy logic)
Use existing assistant plugin contract as source of truth:
- `getContext`
- `submitCommand`
- `answerFollowUp`
- `approveCommand`
- `rejectCommand`
All bot writes remain approval-gated before execution.

### 4) Hardened `openclaw-base.json` policy (verified against OpenClaw docs)
Create `infra/openclaw-template/config/openclaw-base.json` with this policy:

```json
{
  "session": {
    "dmScope": "per-channel-peer",
    "reset": {
      "mode": "idle",
      "idleMinutes": 1440
    }
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
    "elevated": {
      "enabled": false
    },
    "fs": {
      "workspaceOnly": true
    }
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

### 5) Exec approvals file (separate from openclaw.json)
The exec allowlist is NOT a key in `openclaw.json`. It lives in a separate file that must be
pre-seeded during onboarding at `${STATE_DIR}/exec-approvals.json`:

```json
{
  "version": 1,
  "defaults": {
    "security": "allowlist",
    "ask": "off"
  },
  "agents": {
    "main": {
      "security": "allowlist",
      "ask": "off",
      "allowlist": [
        { "pattern": "/usr/bin/curl" }
      ]
    }
  }
}
```

Notes:
- `ask: "off"` prevents approval prompts in Telegram (no human at a terminal to approve).
- Patterns must use resolved binary paths (`/usr/bin/curl`), not basenames.
- File permissions must be `0o600` (owner-only).

Policy notes:
- This policy is mandatory for production isolation.
- `GATHERLY_BASE_URL` must be private-network only even though `curl` is allowed.
- OpenClaw has no native event-driven session reset (no `onApprove`/`onReject` config).
  Sessions reset after 24h idle (`idleMinutes: 1440`). Active conversations keep context
  until idle timeout. This is acceptable because only allowlisted admins can DM the bot.

## Implementation Plan

### Execution structure (adopted additions)
1. Create a monorepo-owned template at `infra/openclaw-template/`.
2. Copy from `~/code/openclaw-railway-template/` into `infra/openclaw-template/`, excluding `.git/`, `.github/`, `CONTRIBUTING.md`, `CLAUDE.md`, and `docs/`.
3. Keep skill files self-contained inside template build context:
- `infra/openclaw-template/skills/gatherly-command-gateway/SKILL.md`
- `infra/openclaw-template/skills/gatherly-command-gateway/references/api.md`
4. Keep a template-local hardened config file:
- `infra/openclaw-template/config/openclaw-base.json`
5. Use Railway service root directory pointing at `infra/openclaw-template/` for the OpenClaw service.

## Phase 1: Template hardening (OpenClaw repo)
1. Endpoint isolation controls
- Add guard middleware to disable `/setup*` when `OPENCLAW_SETUP_ENABLED=false`
- Keep `/openclaw` reachable
- Remove/disable debug endpoints in production mode

2. Session isolation defaults
- Set `session.dmScope: "per-channel-peer"` via `openclaw-base.json`
- Set `session.reset.mode: "idle"` + `session.reset.idleMinutes: 1440` (24h idle TTL)
- Note: OpenClaw has no native event-driven session reset. Sessions expire after 24h of
  inactivity. Active command conversations naturally keep context until idle timeout.

3. Startup/reliability hardening
- Replace narrow lock cleanup with robust preflight:
  - detect existing gateway process/port first
  - clean only stale lock/pid artifacts
  - avoid duplicate spawn loops
- Remove duplicate `/setup/healthz` handler
- Add bounded restart backoff with jitter

4. Secrets and network safety
- Redact Gatherly URL/token in logs
- Reject non-private `GATHERLY_BASE_URL` in production
- Keep volume state in `/data/.openclaw`, treat `/tmp/openclaw*` as disposable runtime only
5. Apply hardened base config safely
- Load `config/openclaw-base.json` during onboarding/bootstrap and apply using granular key writes (avoid whole-object overwrite when possible).
- Fail setup if required policy keys cannot be applied.

## Phase 2: Gatherly alignment
1. Keep assistant plugin as single execution authority
- no business-rule duplication in OpenClaw
- OpenClaw submits canonical IDs only

2. Bot key hygiene
- generate dedicated key per environment
- rotate + revoke old keys
- enforce expiry policy for keys (if not already strict)

3. Optional facade decision (only if needed later)
- if OpenClaw-side tRPC coupling is brittle, add a thin REST ingress that maps 1:1 to assistant router operations
- keep payload/validation identical

## Phase 3: Railway deployment model
1. Services
- `web` (Gatherly)
- `openclaw` (new)
- optional `ollama` as already used

2. Networking
- OpenClaw -> Gatherly via private DNS only
- no public Gatherly callback path for bot traffic

3. Runtime constraints
- OpenClaw replicas = 1 (stateful volume-backed service)
- dedicated volume mounted at `/data` for OpenClaw only
- healthcheck path should reflect wrapper + gateway readiness

4. Access model
- `/setup` disabled by default post-bootstrap
- maintenance runbook enables setup temporarily, then disables again

## Phase 4: Gatherly-specific UX customization
1. Replace generic setup copy with Gatherly language and assistant workflow
2. Limit channel options to Telegram-first MVP
3. Add explicit status labels that mirror Gatherly action states:
- `needs_input`
- `pending_approval`
- `approved`
- `executed`
- `rejected`
- `failed`
4. Simplify setup wizard flow to Gatherly-specific Telegram onboarding:
- Convert wizard from 3 steps to 2 steps (Auth + Telegram, then Run Setup).
- Remove Discord and Slack inputs from state, validation payload, and summary badges.
- Keep pairing modal Telegram-only.
5. Rebrand startup/support surfaces:
- `src/public/loading.html` title and heading to Gatherly Assistant wording.
- `src/public/tui.html` title to Gatherly Assistant Terminal.
- Primary action color/focus accents aligned to Gatherly teal tokens.

## Test Cases and Scenarios

### Security / isolation
1. `/setup` returns forbidden when disabled in production
2. `/openclaw` remains reachable and functional while `/setup` is blocked
3. OpenClaw startup fails if `GATHERLY_BASE_URL` is public (production mode)
4. Bot calls succeed only via internal DNS path
5. Denied tool groups are blocked at runtime (`group:fs`, `group:web`, `group:ui`, `group:automation`, `process`, `sessions_spawn`, `sessions_send`).
6. Only `curl` is allowed under exec policy.
7. Bundled skills are disabled and only `skills/gatherly-command-gateway` is loaded.

### Session behavior
1. DM sessions are isolated per channel peer (no cross-user memory bleed)
2. Session expires after 24h inactivity
3. Session resets immediately after approve/reject
4. Same user in same peer retains context within TTL

### Approval integrity
1. `submitCommand` creates `pending_approval` only when payload complete
2. Any write attempt without approval is rejected
3. `approveCommand` performs mutation and records audit
4. `rejectCommand` records rejection and no mutation occurs

### Reliability
1. Restart does not spawn duplicate gateway when stale lock exists
2. stale `/tmp/openclaw*` is cleaned safely without deleting active runtime state
3. Healthcheck reflects degraded state when gateway unavailable

### Build and packaging checks
1. `docker build -t gatherly-assistant infra/openclaw-template/` succeeds.
2. Skill path is present in image at `/openclaw-skills/gatherly-command-gateway/SKILL.md`.
3. Setup UI shows Gatherly branding and Telegram-only flow.
4. Hardened config is present and applied in `/data/.openclaw/openclaw.json` after setup run.
5. Run OpenClaw security/audit command available in your pinned version and confirm policy is effective.

## Rollout and Monitoring
1. Staging first with real Telegram test account
2. Validate end-to-end flow:
- Telegram -> OpenClaw -> Gatherly private DNS -> pending approval -> approve -> execution
3. Enable prod with setup disabled by default
4. Monitor:
- gateway restart count
- approval latency
- failed command rates
- lock/stale runtime incidents

## Assumptions and Defaults
- Gatherly assistant plugin endpoints remain the command authority
- One OpenClaw gateway per environment is sufficient for current traffic
- Telegram is primary channel for MVP
- All write operations must stay approval-gated
- Session policy defaults to 24h TTL + reset on approve/reject
