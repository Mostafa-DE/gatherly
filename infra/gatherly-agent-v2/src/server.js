import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import express from "express";
import httpProxy from "http-proxy";
import pty from "node-pty";
import { WebSocketServer } from "ws";

const PORT = Number.parseInt(process.env.PORT ?? "8080", 10);
const STATE_DIR =
  process.env.OPENCLAW_STATE_DIR?.trim() ||
  path.join(os.homedir(), ".openclaw");
const WORKSPACE_DIR =
  process.env.OPENCLAW_WORKSPACE_DIR?.trim() ||
  path.join(STATE_DIR, "workspace");

const SETUP_PASSWORD = process.env.SETUP_PASSWORD?.trim();

// ========== GATHERLY INTEGRATION ==========
const GATHERLY_BASE_URL = process.env.GATHERLY_BASE_URL?.trim();
const GATHERLY_BOT_API_KEY = process.env.GATHERLY_BOT_API_KEY?.trim();
if (!GATHERLY_BASE_URL) console.warn("[warn] GATHERLY_BASE_URL not set");
if (!GATHERLY_BOT_API_KEY) console.warn("[warn] GATHERLY_BOT_API_KEY not set");

// Debug logging helper
const DEBUG = process.env.OPENCLAW_TEMPLATE_DEBUG?.toLowerCase() === "true";
function debug(...args) {
  if (DEBUG) console.log(...args);
}

// Gateway admin token (protects Openclaw gateway + Control UI).
// Must be stable across restarts. If not provided via env, persist it in the state dir.
function resolveGatewayToken() {
  const envTok = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
  if (envTok) return envTok;

  const tokenPath = path.join(STATE_DIR, "gateway.token");
  try {
    const existing = fs.readFileSync(tokenPath, "utf8").trim();
    if (existing) return existing;
  } catch (err) {
    console.warn(
      `[gateway-token] could not read existing token: ${err.code || err.message}`,
    );
  }

  const generated = crypto.randomBytes(32).toString("hex");
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(tokenPath, generated, { encoding: "utf8", mode: 0o600 });
  } catch (err) {
    console.warn(
      `[gateway-token] could not persist token: ${err.code || err.message}`,
    );
  }
  return generated;
}

const OPENCLAW_GATEWAY_TOKEN = resolveGatewayToken();
process.env.OPENCLAW_GATEWAY_TOKEN = OPENCLAW_GATEWAY_TOKEN;

let cachedOpenclawVersion = null;
let cachedChannelsHelp = null;

async function getOpenclawInfo() {
  if (!cachedOpenclawVersion) {
    const [version, channelsHelp] = await Promise.all([
      runCmd(OPENCLAW_NODE, clawArgs(["--version"])),
      runCmd(OPENCLAW_NODE, clawArgs(["channels", "add", "--help"])),
    ]);
    cachedOpenclawVersion = version.output.trim();
    cachedChannelsHelp = channelsHelp.output;
  }
  return { version: cachedOpenclawVersion, channelsHelp: cachedChannelsHelp };
}

const INTERNAL_GATEWAY_PORT = Number.parseInt(
  process.env.INTERNAL_GATEWAY_PORT ?? "18789",
  10,
);
const INTERNAL_GATEWAY_HOST = process.env.INTERNAL_GATEWAY_HOST ?? "127.0.0.1";
const GATEWAY_TARGET = `http://${INTERNAL_GATEWAY_HOST}:${INTERNAL_GATEWAY_PORT}`;

const OPENCLAW_ENTRY =
  process.env.OPENCLAW_ENTRY?.trim() || "/openclaw/dist/entry.js";
const OPENCLAW_NODE = process.env.OPENCLAW_NODE?.trim() || "node";

const ENABLE_WEB_TUI = process.env.ENABLE_WEB_TUI?.toLowerCase() === "true";
const RUN_DOCTOR_ON_BOOT =
  process.env.OPENCLAW_RUN_DOCTOR_ON_BOOT?.toLowerCase() === "true";
const TELEGRAM_CHANNEL_MODE =
  process.env.OPENCLAW_TELEGRAM_CHANNEL_MODE?.trim().toLowerCase() || "polling";
const TUI_IDLE_TIMEOUT_MS = Number.parseInt(
  process.env.TUI_IDLE_TIMEOUT_MS ?? "300000",
  10,
);
const TUI_MAX_SESSION_MS = Number.parseInt(
  process.env.TUI_MAX_SESSION_MS ?? "1800000",
  10,
);

function clawArgs(args) {
  return [OPENCLAW_ENTRY, ...args];
}

function configPath() {
  return (
    process.env.OPENCLAW_CONFIG_PATH?.trim() ||
    path.join(STATE_DIR, "openclaw.json")
  );
}

function isConfigured() {
  try {
    return fs.existsSync(configPath());
  } catch {
    return false;
  }
}

function normalizeTelegramUserId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/^(tg:|telegram:)/i, "").trim();
  return /^\d+$/.test(normalized) ? normalized : null;
}

function extractSkillEndpoints(skillMarkdown) {
  const endpoints = [];
  const rowRegex = /^\|\s*([^|]+?)\s*\|\s*(GET|POST)\s*\|\s*`([^`]+)`\s*\|\s*$/gm;
  for (const match of skillMarkdown.matchAll(rowRegex)) {
    endpoints.push({
      operation: match[1].trim(),
      method: match[2].trim(),
      path: match[3].trim(),
    });
  }
  return endpoints;
}

function extractNumberedSection(skillMarkdown, sectionTitle) {
  const lines = skillMarkdown.split(/\r?\n/);
  const title = `## ${sectionTitle}`.toLowerCase();
  const items = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inSection) {
      if (trimmed.toLowerCase() === title) inSection = true;
      continue;
    }
    if (trimmed.startsWith("## ")) break;
    const item = trimmed.match(/^\d+\.\s+(.*)$/);
    if (item) items.push(item[1].trim());
  }

  return items;
}

let gatewayProc = null;
let gatewayStarting = null;
let gatewayHealthy = false;  // Track if gateway responded to health check
let shuttingDown = false;    // Set true on SIGTERM/SIGINT to suppress auto-restart

// Debug breadcrumbs for common Railway failures (502 / "Application failed to respond").
let lastGatewayError = null;
let lastGatewayExit = null;
let lastDoctorOutput = null;
let lastDoctorAt = null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForGatewayReady(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const start = Date.now();
  const endpoints = ["/openclaw", "/openclaw", "/", "/health"];

  while (Date.now() - start < timeoutMs) {
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(`${GATEWAY_TARGET}${endpoint}`, {
          method: "GET",
        });
        if (res) {
          console.log(`[gateway] ready at ${endpoint}`);
          return true;
        }
      } catch (err) {
        if (err.code !== "ECONNREFUSED" && err.cause?.code !== "ECONNREFUSED") {
          const msg = err.code || err.message;
          if (msg !== "fetch failed" && msg !== "UND_ERR_CONNECT_TIMEOUT") {
            console.warn(`[gateway] health check error: ${msg}`);
          }
        }
      }
    }
    await sleep(250);
  }
  console.error(`[gateway] failed to become ready after ${timeoutMs / 1000} seconds`);
  return false;
}

async function startGateway() {
  if (gatewayProc) return;
  if (!isConfigured()) throw new Error("Gateway cannot start: not configured");

  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });

  // Gatherly: clear stale Telegram webhook and re-apply all config on every boot
  await clearTelegramWebhookIfPollingMode();
  await ensureGatherlyConfig();

  // Clean up stale lock files before spawning to prevent startup failures
  for (const lockPath of [
    path.join(STATE_DIR, "gateway.lock"),
    "/tmp/openclaw-gateway.lock",
  ]) {
    try {
      fs.rmSync(lockPath, { force: true });
    } catch {}
  }

  // Sync wrapper token to openclaw.json before every gateway start.
  // This ensures the gateway's config-file token matches what the wrapper injects via proxy.
  console.log(`[gateway] ========== GATEWAY START TOKEN SYNC ==========`);
  console.log(`[gateway] Syncing wrapper token to config (length: ${OPENCLAW_GATEWAY_TOKEN.length})`);
  debug(`[gateway] Token preview: ${OPENCLAW_GATEWAY_TOKEN.slice(0, 16)}...`);

  const syncResult = await runCmd(
    OPENCLAW_NODE,
    clawArgs(["config", "set", "gateway.auth.token", OPENCLAW_GATEWAY_TOKEN]),
  );

  console.log(`[gateway] Sync result: exit code ${syncResult.code}`);
  if (syncResult.output?.trim()) {
    console.log(`[gateway] Sync output: ${syncResult.output}`);
  }

  const args = [
    "gateway",
    "run",
    "--bind",
    "loopback",
    "--port",
    String(INTERNAL_GATEWAY_PORT),
    "--auth",
    "token",
    "--token",
    OPENCLAW_GATEWAY_TOKEN,
    "--allow-unconfigured",
  ];

  gatewayProc = childProcess.spawn(OPENCLAW_NODE, clawArgs(args), {
    stdio: "inherit",
    env: {
      ...process.env,
      OPENCLAW_STATE_DIR: STATE_DIR,
      OPENCLAW_WORKSPACE_DIR: WORKSPACE_DIR,
      GATHERLY_BASE_URL: process.env.GATHERLY_BASE_URL || "",
      GATHERLY_BOT_API_KEY: process.env.GATHERLY_BOT_API_KEY || "",
    },
  });

  const safeArgs = args.map((arg, i) =>
    args[i - 1] === "--token" ? "[REDACTED]" : arg
  );
  console.log(
    `[gateway] starting with command: ${OPENCLAW_NODE} ${clawArgs(safeArgs).join(" ")}`,
  );
  console.log(`[gateway] STATE_DIR: ${STATE_DIR}`);
  console.log(`[gateway] WORKSPACE_DIR: ${WORKSPACE_DIR}`);
  console.log(`[gateway] config path: ${configPath()}`);

  gatewayProc.on("error", (err) => {
    console.error(`[gateway] spawn error: ${String(err)}`);
    lastGatewayError = String(err);
    gatewayProc = null;
  });

  gatewayProc.on("exit", (code, signal) => {
    console.error(`[gateway] exited code=${code} signal=${signal}`);
    lastGatewayExit = { code, signal, at: new Date().toISOString() };
    gatewayProc = null;
    gatewayHealthy = false;
    if (!shuttingDown && isConfigured()) {
      console.log("[gateway] scheduling auto-restart in 2s...");
      setTimeout(() => {
        if (!shuttingDown && !gatewayProc && isConfigured()) {
          ensureGatewayRunning().catch((err) => {
            console.error(`[gateway] auto-restart failed: ${err.message}`);
          });
        }
      }, 2000);
    }
  });
}

async function ensureGatewayRunning() {
  if (!isConfigured()) return { ok: false, reason: "not configured" };
  if (gatewayProc) return { ok: true };
  if (!gatewayStarting) {
    gatewayStarting = (async () => {
      await startGateway();
      const ready = await waitForGatewayReady({ timeoutMs: 60_000 });
      if (!ready) {
        throw new Error("Gateway did not become ready in time");
      }
    })().finally(() => {
      gatewayStarting = null;
    });
  }
  await gatewayStarting;
  return { ok: true };
}

function isGatewayStarting() {
  return gatewayStarting !== null;
}

function isGatewayReady() {
  return gatewayProc !== null && gatewayStarting === null;
}

async function restartGateway() {
  if (gatewayProc) {
    try {
      gatewayProc.kill("SIGTERM");
    } catch (err) {
      console.warn(`[gateway] kill error: ${err.message}`);
    }
    await sleep(750);
    gatewayProc = null;
  }
  return ensureGatewayRunning();
}

// ========== PER-IP RATE LIMITER (sliding window, no external deps) ==========
const setupRateLimiter = {
  attempts: new Map(),
  windowMs: 60_000,
  maxAttempts: 50,
  cleanupInterval: setInterval(function () {
    const now = Date.now();
    for (const [ip, data] of setupRateLimiter.attempts) {
      if (now - data.windowStart > setupRateLimiter.windowMs) {
        setupRateLimiter.attempts.delete(ip);
      }
    }
  }, 60_000),

  isRateLimited(ip) {
    const now = Date.now();
    const data = this.attempts.get(ip);
    if (!data || now - data.windowStart > this.windowMs) {
      this.attempts.set(ip, { windowStart: now, count: 1 });
      return false;
    }
    data.count++;
    return data.count > this.maxAttempts;
  },
};

function requireSetupAuth(req, res, next) {
  if (!SETUP_PASSWORD) {
    return res
      .status(500)
      .type("text/plain")
      .send(
        "SETUP_PASSWORD is not set. Set it in Railway Variables before using /setup.",
      );
  }

  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  if (setupRateLimiter.isRateLimited(ip)) {
    return res.status(429).type("text/plain").send("Too many requests. Try again later.");
  }

  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) {
    res.set("WWW-Authenticate", 'Basic realm="Gatherly Assistant Setup"');
    return res.status(401).send("Auth required");
  }
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const idx = decoded.indexOf(":");
  const password = idx >= 0 ? decoded.slice(idx + 1) : "";
  const passwordHash = crypto.createHash("sha256").update(password).digest();
  const expectedHash = crypto.createHash("sha256").update(SETUP_PASSWORD).digest();
  const isValid = crypto.timingSafeEqual(passwordHash, expectedHash);
  if (!isValid) {
    res.set("WWW-Authenticate", 'Basic realm="Gatherly Assistant Setup"');
    return res.status(401).send("Invalid password");
  }
  return next();
}

async function probeGateway() {
  // Don't assume HTTP — the gateway primarily speaks WebSocket.
  // A simple TCP connect check is enough for "is it up".
  const net = await import("node:net");

  return await new Promise((resolve) => {
    const sock = net.createConnection({
      host: INTERNAL_GATEWAY_HOST,
      port: INTERNAL_GATEWAY_PORT,
      timeout: 750,
    });

    const done = (ok) => {
      try { sock.destroy(); } catch {}
      resolve(ok);
    };

    sock.on("connect", () => done(true));
    sock.on("timeout", () => done(false));
    sock.on("error", () => done(false));
  });
}

// Load loading.html once at startup for use in proxy error responses
let loadingHtmlContent = null;
try {
  loadingHtmlContent = fs.readFileSync(
    path.join(process.cwd(), "src", "public", "loading.html"),
    "utf8",
  );
} catch {
  // Fallback inline if file missing
  loadingHtmlContent = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="5"/><title>Starting</title></head><body><p>Gatherly Assistant is starting. This page will refresh automatically.</p></body></html>`;
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// Minimal health endpoint for Railway.
app.get("/setup/healthz", (_req, res) => res.json({ ok: true }));

// Public health endpoint (no auth) so Railway can probe without /setup.
// Keep this free of secrets.
app.get("/healthz", async (_req, res) => {
  let gateway = "unconfigured";
  if (isConfigured()) {
    gateway = isGatewayReady() ? "ready" : "starting";
  }
  res.json({ ok: true, gateway });
});

app.get("/setup/healthz", async (_req, res) => {
  const configured = isConfigured();
  const gatewayRunning = isGatewayReady();
  const starting = isGatewayStarting();
  let gatewayReachable = false;

  if (gatewayRunning) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const r = await fetch(`${GATEWAY_TARGET}/`, { signal: controller.signal });
      clearTimeout(timeout);
      gatewayReachable = r !== null;
    } catch {}
  }

  res.json({
    ok: true,
    wrapper: true,
    configured,
    gatewayRunning,
    gatewayStarting: starting,
    gatewayReachable,
  });
});

app.get("/setup", requireSetupAuth, (_req, res) => {
  res.sendFile(path.join(process.cwd(), "src", "public", "setup.html"));
});

app.get("/setup/api/status", requireSetupAuth, async (_req, res) => {
  const { version, channelsHelp } = await getOpenclawInfo();

  const authGroups = [
    {
      value: "openai",
      label: "OpenAI",
      hint: "Codex OAuth + API key",
      options: [
        { value: "codex-cli", label: "OpenAI Codex OAuth (Codex CLI)" },
        { value: "openai-codex", label: "OpenAI Codex (ChatGPT OAuth)" },
        { value: "openai-api-key", label: "OpenAI API key" },
      ],
    },
    {
      value: "anthropic",
      label: "Anthropic",
      hint: "Claude Code CLI + API key",
      options: [
        { value: "claude-cli", label: "Anthropic token (Claude Code CLI)" },
        { value: "token", label: "Anthropic token (paste setup-token)" },
        { value: "apiKey", label: "Anthropic API key" },
      ],
    },
    {
      value: "google",
      label: "Google",
      hint: "Gemini API key + OAuth",
      options: [
        { value: "gemini-api-key", label: "Google Gemini API key" },
        { value: "google-antigravity", label: "Google Antigravity OAuth" },
        { value: "google-gemini-cli", label: "Google Gemini CLI OAuth" },
      ],
    },
    {
      value: "openrouter",
      label: "OpenRouter",
      hint: "API key",
      options: [{ value: "openrouter-api-key", label: "OpenRouter API key" }],
    },
    {
      value: "ai-gateway",
      label: "Vercel AI Gateway",
      hint: "API key",
      options: [
        { value: "ai-gateway-api-key", label: "Vercel AI Gateway API key" },
      ],
    },
    {
      value: "moonshot",
      label: "Moonshot AI",
      hint: "Kimi K2 + Kimi Code",
      options: [
        { value: "moonshot-api-key", label: "Moonshot AI API key" },
        { value: "kimi-code-api-key", label: "Kimi Code API key" },
      ],
    },
    {
      value: "zai",
      label: "Z.AI (GLM 4.7)",
      hint: "API key",
      options: [{ value: "zai-api-key", label: "Z.AI (GLM 4.7) API key" }],
    },
    {
      value: "minimax",
      label: "MiniMax",
      hint: "M2.1 (recommended)",
      options: [
        { value: "minimax-api", label: "MiniMax M2.1" },
        { value: "minimax-api-lightning", label: "MiniMax M2.1 Lightning" },
      ],
    },
    {
      value: "qwen",
      label: "Qwen",
      hint: "OAuth",
      options: [{ value: "qwen-portal", label: "Qwen OAuth" }],
    },
    {
      value: "copilot",
      label: "Copilot",
      hint: "GitHub + local proxy",
      options: [
        {
          value: "github-copilot",
          label: "GitHub Copilot (GitHub device login)",
        },
        { value: "copilot-proxy", label: "Copilot Proxy (local)" },
      ],
    },
    {
      value: "synthetic",
      label: "Synthetic",
      hint: "Anthropic-compatible (multi-model)",
      options: [{ value: "synthetic-api-key", label: "Synthetic API key" }],
    },
    {
      value: "opencode-zen",
      label: "OpenCode Zen",
      hint: "API key",
      options: [
        { value: "opencode-zen", label: "OpenCode Zen (multi-model proxy)" },
      ],
    },
  ];

  res.json({
    configured: isConfigured(),
    gatewayTarget: GATEWAY_TARGET,
    openclawVersion: version,
    channelsAddHelp: channelsHelp,
    authGroups,
    tuiEnabled: ENABLE_WEB_TUI,
  });
});

function buildOnboardArgs(payload) {
  const args = [
    "onboard",
    "--non-interactive",
    "--accept-risk",
    "--json",
    "--no-install-daemon",
    "--skip-health",
    "--workspace",
    WORKSPACE_DIR,
    "--gateway-bind",
    "loopback",
    "--gateway-port",
    String(INTERNAL_GATEWAY_PORT),
    "--gateway-auth",
    "token",
    "--gateway-token",
    OPENCLAW_GATEWAY_TOKEN,
    "--flow",
    payload.flow || "quickstart",
  ];

  if (payload.authChoice) {
    args.push("--auth-choice", payload.authChoice);

    const secret = (payload.authSecret || "").trim();
    const map = {
      "openai-api-key": "--openai-api-key",
      apiKey: "--anthropic-api-key",
      "openrouter-api-key": "--openrouter-api-key",
      "ai-gateway-api-key": "--ai-gateway-api-key",
      "moonshot-api-key": "--moonshot-api-key",
      "kimi-code-api-key": "--kimi-code-api-key",
      "gemini-api-key": "--gemini-api-key",
      "zai-api-key": "--zai-api-key",
      "minimax-api": "--minimax-api-key",
      "minimax-api-lightning": "--minimax-api-key",
      "synthetic-api-key": "--synthetic-api-key",
      "opencode-zen": "--opencode-zen-api-key",
    };
    const flag = map[payload.authChoice];
    if (flag && secret) {
      args.push(flag, secret);
    }

    if (payload.authChoice === "token" && secret) {
      args.push("--token-provider", "anthropic", "--token", secret);
    }
  }

  return args;
}

function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const proc = childProcess.spawn(cmd, args, {
      ...opts,
      env: {
        ...process.env,
        OPENCLAW_STATE_DIR: STATE_DIR,
        OPENCLAW_WORKSPACE_DIR: WORKSPACE_DIR,
        GATHERLY_BASE_URL: process.env.GATHERLY_BASE_URL || "",
        GATHERLY_BOT_API_KEY: process.env.GATHERLY_BOT_API_KEY || "",
      },
    });

    let out = "";
    proc.stdout?.on("data", (d) => (out += d.toString("utf8")));
    proc.stderr?.on("data", (d) => (out += d.toString("utf8")));

    proc.on("error", (err) => {
      out += `\n[spawn error] ${String(err)}\n`;
      resolve({ code: 127, output: out });
    });

    proc.on("close", (code) => resolve({ code: code ?? 0, output: out }));
  });
}

// ========== GATHERLY: SHARED HELPERS ==========

async function configureChannel(name, cfgObj) {
  const set = await runCmd(
    OPENCLAW_NODE,
    clawArgs([
      "config",
      "set",
      "--json",
      `channels.${name}`,
      JSON.stringify(cfgObj),
    ]),
  );
  const get = await runCmd(
    OPENCLAW_NODE,
    clawArgs(["config", "get", `channels.${name}`]),
  );
  return (
    `\n[${name} config] exit=${set.code} (output ${set.output.length} chars)\n${set.output || "(no output)"}` +
    `\n[${name} verify] exit=${get.code} (output ${get.output.length} chars)\n${get.output || "(no output)"}`
  );
}

/**
 * Boot-time reconciliation: re-applies ALL Gatherly hardened config on every
 * gateway start. This ensures config doesn't drift between deploys when env
 * vars change, OpenClaw updates, or the Control UI modifies settings.
 */
async function ensureGatherlyConfig() {
  console.log("[gatherly] Reconciling Gatherly config...");

  // 1. Re-apply hardened config from openclaw-base.json
  const baseConfigPath = path.join(process.cwd(), "config", "openclaw-base.json");
  if (fs.existsSync(baseConfigPath)) {
    const baseConfig = JSON.parse(fs.readFileSync(baseConfigPath, "utf8"));
    for (const [key, value] of Object.entries(baseConfig)) {
      const r = await runCmd(OPENCLAW_NODE, clawArgs(["config", "set", "--json", key, JSON.stringify(value)]));
      if (r.code !== 0) console.warn(`[gatherly] config set ${key} failed (exit=${r.code})`);
    }
    console.log("[gatherly] Hardened config applied from openclaw-base.json");
  }

  // 2. Always overwrite exec-approvals.json on the volume (container has latest)
  const execApprovalsTemplate = path.join(process.cwd(), "config", "exec-approvals.json");
  const execApprovalsTarget = path.join(STATE_DIR, "exec-approvals.json");
  if (fs.existsSync(execApprovalsTemplate)) {
    fs.copyFileSync(execApprovalsTemplate, execApprovalsTarget);
    fs.chmodSync(execApprovalsTarget, 0o600);
    console.log("[gatherly] exec-approvals.json overwritten on volume");
  }

  // 3. Always overwrite all workspace markdown files on the volume
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  const workspaceFiles = ["IDENTITY.md", "SOUL.md", "BOOTSTRAP.md", "USER.md"];
  for (const file of workspaceFiles) {
    const src = path.join(process.cwd(), "config", file);
    const dst = path.join(WORKSPACE_DIR, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
    }
  }

  // 3b. Sync skill snapshot + derive runtime instruction files from skill source of truth.
  const skillPath = path.join("/openclaw-skills", "gatherly-command-gateway", "SKILL.md");
  const skillSnapshotTarget = path.join(WORKSPACE_DIR, "SKILL-SNAPSHOT.md");
  let skillMarkdown = "";
  let skillEndpoints = [];
  let nonNegotiableRules = [];

  try {
    skillMarkdown = fs.readFileSync(skillPath, "utf8");
    fs.writeFileSync(skillSnapshotTarget, skillMarkdown, "utf8");
    skillEndpoints = extractSkillEndpoints(skillMarkdown);
    nonNegotiableRules = extractNumberedSection(skillMarkdown, "Non-Negotiable Rules");
    console.log("[gatherly] Skill snapshot synced from /openclaw-skills");
  } catch (err) {
    console.warn(`[gatherly] Skill sync failed: ${err.code || err.message}`);
  }

  const agentsTemplate = path.join(process.cwd(), "config", "AGENTS.md");
  const agentsTarget = path.join(WORKSPACE_DIR, "AGENTS.md");
  if (fs.existsSync(agentsTemplate)) {
    const baseAgents = fs.readFileSync(agentsTemplate, "utf8").trimEnd();
    const endpointLines = skillEndpoints.length > 0
      ? skillEndpoints.map((ep) => `- \`${ep.method} ${ep.path}\` (${ep.operation})`).join("\n")
      : "- Endpoints could not be parsed from SKILL-SNAPSHOT.md; use the skill text directly.";
    const rulesLines = nonNegotiableRules.length > 0
      ? nonNegotiableRules.map((rule, idx) => `${idx + 1}. ${rule}`).join("\n")
      : "1. Non-negotiable rules could not be parsed; use the skill text directly.";
    const syncedBlock = `

## Runtime Skill Sync

Boot source of truth: \`${skillPath}\`
Workspace snapshot: \`SKILL-SNAPSHOT.md\`

Always follow \`SKILL-SNAPSHOT.md\` for workflows, payload shape, and endpoint names.

### Endpoints (derived from skill)
${endpointLines}

### Non-Negotiable Rules (derived from skill)
${rulesLines}
`;
    fs.writeFileSync(agentsTarget, `${baseAgents}${syncedBlock}\n`, "utf8");
  }

  // 3c. Write TOOLS.md with actual env var values + endpoint list derived from skill snapshot
  const endpointList = skillEndpoints.length > 0
    ? skillEndpoints.map((ep) => `- \`${ep.method} ${ep.path}\``).join("\n")
    : "- Read `SKILL-SNAPSHOT.md` to find current endpoint paths.";
  const toolsMd = `# Tools

You have one tool: \`exec\` running \`/usr/bin/curl\` only.

## Gatherly API Connection
- **Base URL:** ${GATHERLY_BASE_URL || "NOT SET"}
- **API Key:** ${GATHERLY_BOT_API_KEY || "NOT SET"}

When making curl calls, use these exact values:
\`\`\`
/usr/bin/curl -s -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY || "NOT SET"}" "${GATHERLY_BASE_URL || "NOT SET"}/api/trpc/..."
\`\`\`

Use endpoint paths from \`SKILL-SNAPSHOT.md\` (synced from \`${skillPath}\`):
${endpointList}

No other commands are available. Only /usr/bin/curl.
`;
  fs.writeFileSync(path.join(WORKSPACE_DIR, "TOOLS.md"), toolsMd);
  console.log("[gatherly] Workspace files overwritten: " + [...workspaceFiles, "AGENTS.md (skill-synced)", "TOOLS.md (skill-derived)", "SKILL-SNAPSHOT.md"].join(", "));

  // 4. Reconcile Telegram channel config from current env vars
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const telegramAdminId = process.env.TELEGRAM_ADMIN_ID?.trim();
  if (telegramToken || telegramAdminId) {
    try {
      const result = await runCmd(OPENCLAW_NODE, clawArgs(["config", "get", "channels.telegram"]));
      let existingConfig = {};

      if (result.code === 0 && result.output.trim() && !result.output.includes("not found")) {
        try {
          existingConfig = JSON.parse(result.output.trim());
        } catch {
          existingConfig = {};
        }
      } else if (!telegramToken) {
        // Can't recreate a missing channel config without a token.
        console.log("[gatherly] Telegram channel reconciliation skipped (no token, no existing config)");
        return;
      }

      const mergedConfig = { ...existingConfig };
      let changed = false;
      const normalizedAdminId = normalizeTelegramUserId(telegramAdminId);
      if (telegramAdminId && !normalizedAdminId) {
        console.warn("[gatherly] TELEGRAM_ADMIN_ID is not numeric; falling back to dmPolicy=pairing");
      }

      if (telegramToken) {
        if (mergedConfig.enabled !== true) { mergedConfig.enabled = true; changed = true; }
        if (mergedConfig.groupPolicy !== "disabled") { mergedConfig.groupPolicy = "disabled"; changed = true; }
        if (!mergedConfig.streamMode) { mergedConfig.streamMode = "partial"; changed = true; }
        if (mergedConfig.botToken !== telegramToken) { mergedConfig.botToken = telegramToken; changed = true; }
      }

      // Open DM policy — Gatherly's getCapabilities endpoint handles
      // authorization (verifies Telegram user is linked + has admin/owner role).
      // This allows any linked admin to message the bot without a static allowlist.
      // OpenClaw requires allowFrom: ["*"] when dmPolicy is "open".
      if (mergedConfig.dmPolicy !== "open") {
        mergedConfig.dmPolicy = "open";
        changed = true;
      }
      const currentAllowFrom = Array.isArray(mergedConfig.allowFrom) ? mergedConfig.allowFrom : [];
      if (!currentAllowFrom.includes("*")) {
        mergedConfig.allowFrom = ["*"];
        changed = true;
      }


      if (changed) {
        const update = await runCmd(
          OPENCLAW_NODE,
          clawArgs(["config", "set", "--json", "channels.telegram", JSON.stringify(mergedConfig)]),
        );
        if (update.code === 0) {
          console.log("[gatherly] Reconciled channels.telegram config");
        } else {
          console.warn(`[gatherly] Failed to reconcile channels.telegram (exit=${update.code})`);
        }
      } else {
        console.log("[gatherly] Telegram channel config already up-to-date");
      }
    } catch (err) {
      console.warn(`[gatherly] Telegram reconciliation error: ${err.message}`);
    }
  }

  // 5. Set allowedOrigins dynamically from RAILWAY_PUBLIC_DOMAIN
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayDomain) {
    const origin = `https://${railwayDomain}`;
    const r = await runCmd(
      OPENCLAW_NODE,
      clawArgs(["config", "set", "--json", "gateway.controlUi.allowedOrigins", JSON.stringify([origin])]),
    );
    if (r.code === 0) {
      console.log(`[gatherly] Set allowedOrigins to [${origin}]`);
    } else {
      console.warn(`[gatherly] Failed to set allowedOrigins (exit=${r.code})`);
    }
  }

  console.log("[gatherly] Config reconciliation complete");
}

/**
 * Telegram Bot API forbids long-polling getUpdates while a webhook is active.
 * This wrapper defaults to polling mode, so clear stale webhook state at boot.
 */
async function clearTelegramWebhookIfPollingMode() {
  if (TELEGRAM_CHANNEL_MODE !== "polling") return;
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!telegramToken) return;

  const apiBase = `https://api.telegram.org/bot${telegramToken}`;

  try {
    const infoRes = await fetch(`${apiBase}/getWebhookInfo`, { method: "GET" });
    if (!infoRes.ok) {
      console.warn(`[telegram-webhook] getWebhookInfo failed with status ${infoRes.status}`);
      return;
    }
    const info = await infoRes.json();
    const webhookUrl = info?.result?.url;
    if (!webhookUrl) return;

    console.log("[telegram-webhook] Active webhook detected; deleting for polling mode");
    const deleteRes = await fetch(`${apiBase}/deleteWebhook`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "drop_pending_updates=false",
    });
    if (deleteRes.ok) {
      console.log("[telegram-webhook] Webhook deleted successfully");
    } else {
      console.warn(`[telegram-webhook] deleteWebhook failed with status ${deleteRes.status}`);
    }
  } catch (err) {
    console.warn(`[telegram-webhook] Could not reconcile webhook state: ${err.message}`);
  }
}

/**
 * Auto-configure from environment variables on first boot.
 * Skipped if already configured (openclaw.json exists).
 */
async function autoConfigureIfNeeded() {
  if (isConfigured()) return;

  const authChoice = process.env.OPENCLAW_AUTH_CHOICE?.trim() || "openai-api-key";
  const apiKey = process.env.OPENCLAW_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const telegramAdminId = process.env.TELEGRAM_ADMIN_ID?.trim();

  if (!telegramToken) {
    console.log("[auto-config] TELEGRAM_BOT_TOKEN not set, skipping auto-config");
    return;
  }

  // OAuth providers require interactive login — can't auto-config
  const interactiveProviders = [
    "codex-cli", "openai-codex", "claude-cli",
    "google-antigravity", "google-gemini-cli", "qwen-portal",
    "github-copilot",
  ];
  if (interactiveProviders.includes(authChoice)) {
    console.log(`[auto-config] Auth choice "${authChoice}" requires interactive login — skipping auto-config`);
    console.log("[auto-config] Complete setup manually via /setup or /tui");
    return;
  }

  // API key providers require a key
  if (!apiKey) {
    console.log("[auto-config] No API key found (OPENCLAW_API_KEY / OPENAI_API_KEY) — skipping auto-config");
    return;
  }

  console.log("[auto-config] Starting automatic configuration...");
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });

  // 1. Run openclaw onboard
  const payload = { flow: "quickstart", authChoice, authSecret: apiKey };
  const onboardArgs = buildOnboardArgs(payload);
  const result = await runCmd(OPENCLAW_NODE, clawArgs(onboardArgs));

  if (result.code !== 0 || !isConfigured()) {
    throw new Error(`Onboard failed (exit=${result.code}): ${result.output}`);
  }
  console.log("[auto-config] Onboard completed successfully");

  // 2. Apply post-onboard gateway settings
  let extra = "";
  extra += "\n[setup] Configuring gateway settings...\n";

  const allowInsecureResult = await runCmd(
    OPENCLAW_NODE,
    clawArgs(["config", "set", "gateway.controlUi.allowInsecureAuth", "true"]),
  );
  extra += `[config] gateway.controlUi.allowInsecureAuth=true exit=${allowInsecureResult.code}\n`;

  const tokenResult = await runCmd(
    OPENCLAW_NODE,
    clawArgs(["config", "set", "gateway.auth.token", OPENCLAW_GATEWAY_TOKEN]),
  );
  extra += `[config] gateway.auth.token exit=${tokenResult.code}\n`;

  const proxiesResult = await runCmd(
    OPENCLAW_NODE,
    clawArgs(["config", "set", "--json", "gateway.trustedProxies", '["127.0.0.1"]']),
  );
  extra += `[config] gateway.trustedProxies exit=${proxiesResult.code}\n`;

  // Set model if provided
  const model = process.env.OPENCLAW_MODEL?.trim();
  if (model) {
    extra += `[setup] Setting model to ${model}...\n`;
    const modelResult = await runCmd(OPENCLAW_NODE, clawArgs(["models", "set", model]));
    extra += `[models set] exit=${modelResult.code}\n${modelResult.output || ""}`;
  }

  // Configure Telegram channel
  if (telegramToken) {
    const normalizedAdminId = normalizeTelegramUserId(telegramAdminId);
    if (telegramAdminId && !normalizedAdminId) {
      extra += "[telegram] TELEGRAM_ADMIN_ID is not numeric; using dmPolicy=pairing\n";
    }
    const channelConfig = {
      enabled: true,
      dmPolicy: "open",
      allowFrom: ["*"],
      botToken: telegramToken,
      groupPolicy: "disabled",
      streamMode: "partial",
    };
    extra += await configureChannel("telegram", channelConfig);
  }

  console.log(extra);

  // 3. Apply Gatherly hardened config (same path as every boot)
  await ensureGatherlyConfig();

  // 4. Start gateway
  await restartGateway();
  console.log("[auto-config] Done — gateway started.");
}

const VALID_FLOWS = ["quickstart", "advanced", "manual"];
const VALID_AUTH_CHOICES = [
  "codex-cli",
  "openai-codex",
  "openai-api-key",
  "claude-cli",
  "token",
  "apiKey",
  "gemini-api-key",
  "google-antigravity",
  "google-gemini-cli",
  "openrouter-api-key",
  "ai-gateway-api-key",
  "moonshot-api-key",
  "kimi-code-api-key",
  "zai-api-key",
  "minimax-api",
  "minimax-api-lightning",
  "qwen-portal",
  "github-copilot",
  "copilot-proxy",
  "synthetic-api-key",
  "opencode-zen",
];

function validatePayload(payload) {
  if (payload.flow && !VALID_FLOWS.includes(payload.flow)) {
    return `Invalid flow: ${payload.flow}. Must be one of: ${VALID_FLOWS.join(", ")}`;
  }
  if (payload.authChoice && !VALID_AUTH_CHOICES.includes(payload.authChoice)) {
    return `Invalid authChoice: ${payload.authChoice}`;
  }
  const stringFields = [
    "telegramToken",
    "authSecret",
    "model",
  ];
  for (const field of stringFields) {
    if (payload[field] !== undefined && typeof payload[field] !== "string") {
      return `Invalid ${field}: must be a string`;
    }
  }
  return null;
}

app.post("/setup/api/run", requireSetupAuth, async (req, res) => {
  try {
    if (isConfigured()) {
      await ensureGatewayRunning();
      return res.json({
        ok: true,
        output:
          "Already configured.\nUse Reset setup if you want to rerun onboarding.\n",
      });
    }

    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.mkdirSync(WORKSPACE_DIR, { recursive: true });

    const payload = req.body || {};
    const validationError = validatePayload(payload);
    if (validationError) {
      return res.status(400).json({ ok: false, output: validationError });
    }
    const onboardArgs = buildOnboardArgs(payload);
    const onboard = await runCmd(OPENCLAW_NODE, clawArgs(onboardArgs));

    let extra = "";
    extra += `\n[setup] Onboarding exit=${onboard.code} configured=${isConfigured()}\n`;

    const ok = onboard.code === 0 && isConfigured();

    if (ok) {
      extra += "\n[setup] Configuring gateway settings...\n";

      const allowInsecureResult = await runCmd(
        OPENCLAW_NODE,
        clawArgs(["config", "set", "gateway.controlUi.allowInsecureAuth", "true"]),
      );
      extra += `[config] gateway.controlUi.allowInsecureAuth=true exit=${allowInsecureResult.code}\n`;

      const tokenResult = await runCmd(
        OPENCLAW_NODE,
        clawArgs(["config", "set", "gateway.auth.token", OPENCLAW_GATEWAY_TOKEN]),
      );
      extra += `[config] gateway.auth.token exit=${tokenResult.code}\n`;

      const proxiesResult = await runCmd(
        OPENCLAW_NODE,
        clawArgs(["config", "set", "--json", "gateway.trustedProxies", '["127.0.0.1"]']),
      );
      extra += `[config] gateway.trustedProxies exit=${proxiesResult.code}\n`;

      if (payload.model?.trim()) {
        extra += `[setup] Setting model to ${payload.model.trim()}...\n`;
        const modelResult = await runCmd(
          OPENCLAW_NODE,
          clawArgs(["models", "set", payload.model.trim()]),
        );
        extra += `[models set] exit=${modelResult.code}\n${modelResult.output || ""}`;
      }

      // Gatherly: Telegram-only with open DM policy (Gatherly API handles auth)
      if (payload.telegramToken?.trim()) {
        const channelConfig = {
          enabled: true,
          dmPolicy: "open",
          allowFrom: ["*"],
          botToken: payload.telegramToken.trim(),
          groupPolicy: "disabled",
          streamMode: "partial",
            };
        extra += await configureChannel("telegram", channelConfig);
      }

      // Gatherly: apply hardened config (same path as every boot)
      await ensureGatherlyConfig();
      extra += "[setup] Gatherly hardened config applied.\n";

      extra += "\n[setup] Starting gateway...\n";
      await restartGateway();
      extra += "[setup] Gateway started.\n";
    }

    return res.status(ok ? 200 : 500).json({
      ok,
      output: `${onboard.output}${extra}`,
    });
  } catch (err) {
    console.error("[/setup/api/run] error:", err);
    return res
      .status(500)
      .json({ ok: false, output: `Internal error: ${String(err)}` });
  }
});

function redactSecrets(text) {
  if (!text) return text;
  // Very small best-effort redaction. (Config paths/values may still contain secrets.)
  return String(text)
    .replace(/(sk-[A-Za-z0-9_-]{10,})/g, "[REDACTED]")
    .replace(/(gho_[A-Za-z0-9_]{10,})/g, "[REDACTED]")
    .replace(/(xox[baprs]-[A-Za-z0-9-]{10,})/g, "[REDACTED]")
    // Telegram bot tokens look like: 123456:ABCDEF...
    .replace(/(\d{5,}:[A-Za-z0-9_-]{10,})/g, "[REDACTED]")
    .replace(/(AA[A-Za-z0-9_-]{10,}:\S{10,})/g, "[REDACTED]")
    .replace(/(gat_[A-Za-z0-9_-]{10,})/g, "[REDACTED]");
}

// ========== WEB TUI: AUTH + SESSION MANAGEMENT ==========

function verifyTuiAuth(req) {
  if (!SETUP_PASSWORD) return false;
  // Check Authorization header (Basic auth)
  const authHeader = req.headers["authorization"] || "";
  if (authHeader.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    const password = decoded.includes(":") ? decoded.split(":").slice(1).join(":") : decoded;
    const passwordHash = crypto.createHash("sha256").update(password).digest();
    const expectedHash = crypto.createHash("sha256").update(SETUP_PASSWORD).digest();
    if (crypto.timingSafeEqual(passwordHash, expectedHash)) return true;
  }
  // Check WebSocket subprotocol for browser clients (browsers can't set custom headers)
  const protocols = (req.headers["sec-websocket-protocol"] || "").split(",").map(s => s.trim());
  for (const proto of protocols) {
    if (proto.startsWith("auth-")) {
      try {
        const decoded = Buffer.from(proto.slice(5), "base64").toString("utf8");
        const password = decoded.includes(":") ? decoded.split(":").slice(1).join(":") : decoded;
        const passwordHash = crypto.createHash("sha256").update(password).digest();
        const expectedHash = crypto.createHash("sha256").update(SETUP_PASSWORD).digest();
        if (crypto.timingSafeEqual(passwordHash, expectedHash)) return true;
      } catch { /* invalid base64 */ }
    }
  }
  return false;
}

let activeTuiSession = null;

function createTuiWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws, req) => {
    const clientIp = req.socket?.remoteAddress || "unknown";
    console.log(`[tui] session started from ${clientIp}`);

    let ptyProcess = null;
    let idleTimer = null;
    let maxSessionTimer = null;

    activeTuiSession = {
      ws,
      pty: null,
      startedAt: Date.now(),
      lastActivity: Date.now(),
    };

    function resetIdleTimer() {
      if (activeTuiSession) {
        activeTuiSession.lastActivity = Date.now();
      }
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        console.log("[tui] session idle timeout");
        ws.close(4002, "Idle timeout");
      }, TUI_IDLE_TIMEOUT_MS);
    }

    function spawnPty(cols, rows) {
      if (ptyProcess) return;

      console.log(`[tui] spawning PTY with ${cols}x${rows}`);
      ptyProcess = pty.spawn(OPENCLAW_NODE, clawArgs(["tui"]), {
        name: "xterm-256color",
        cols,
        rows,
        cwd: WORKSPACE_DIR,
        env: {
          ...process.env,
          OPENCLAW_STATE_DIR: STATE_DIR,
          OPENCLAW_WORKSPACE_DIR: WORKSPACE_DIR,
          GATHERLY_BASE_URL: process.env.GATHERLY_BASE_URL || "",
          GATHERLY_BOT_API_KEY: process.env.GATHERLY_BOT_API_KEY || "",
          TERM: "xterm-256color",
        },
      });

      if (activeTuiSession) {
        activeTuiSession.pty = ptyProcess;
      }

      idleTimer = setTimeout(() => {
        console.log("[tui] session idle timeout");
        ws.close(4002, "Idle timeout");
      }, TUI_IDLE_TIMEOUT_MS);

      maxSessionTimer = setTimeout(() => {
        console.log("[tui] max session duration reached");
        ws.close(4002, "Max session duration");
      }, TUI_MAX_SESSION_MS);

      ptyProcess.onData((data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(data);
        }
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(`[tui] PTY exited code=${exitCode} signal=${signal}`);
        if (ws.readyState === ws.OPEN) {
          ws.close(1000, "Process exited");
        }
      });
    }

    ws.on("message", (message) => {
      resetIdleTimer();
      try {
        const msg = JSON.parse(message.toString());
        if (msg.type === "resize" && msg.cols && msg.rows) {
          const cols = Math.min(Math.max(msg.cols, 10), 500);
          const rows = Math.min(Math.max(msg.rows, 5), 200);
          if (!ptyProcess) {
            spawnPty(cols, rows);
          } else {
            ptyProcess.resize(cols, rows);
          }
        } else if (msg.type === "input" && msg.data && ptyProcess) {
          ptyProcess.write(msg.data);
        }
      } catch (err) {
        console.warn(`[tui] invalid message: ${err.message}`);
      }
    });

    ws.on("close", () => {
      console.log("[tui] session closed");
      clearTimeout(idleTimer);
      clearTimeout(maxSessionTimer);
      if (ptyProcess) {
        try {
          ptyProcess.kill();
        } catch {}
      }
      activeTuiSession = null;
    });

    ws.on("error", (err) => {
      console.error(`[tui] WebSocket error: ${err.message}`);
    });
  });

  return wss;
}

// ========== DEBUG CONSOLE: HELPER FUNCTIONS & ALLOWLIST ==========

// Extract device requestIds from device list output for validation
function extractDeviceRequestIds(output) {
  const ids = [];
  const lines = (output || "").split("\n");
  // Look for lines with requestId format: alphanumeric, underscore, dash
  for (const line of lines) {
    const match = line.match(/requestId[:\s]+([A-Za-z0-9_-]+)/i);
    if (match) ids.push(match[1]);
  }
  return ids;
}

// Allowlisted commands for debug console (security-critical: no arbitrary shell execution)
const ALLOWED_CONSOLE_COMMANDS = new Set([
  // Gateway lifecycle (wrapper-managed, no openclaw CLI needed)
  "gateway.restart",
  "gateway.stop",
  "gateway.start",

  // OpenClaw CLI commands (all safe, read-only or user-controlled)
  "openclaw.version",
  "openclaw.status",
  "openclaw.gateway.status",
  "openclaw.channels.status",
  "openclaw.pairing.list.telegram",
  "openclaw.health",
  "openclaw.doctor",
  "openclaw.logs.tail",
  "openclaw.config.get",
  "openclaw.devices.list",
  "openclaw.devices.approve",
  "openclaw.plugins.list",
  "openclaw.plugins.enable",
]);

// Debug console command handler (POST /setup/api/console/run)
app.post("/setup/api/console/run", requireSetupAuth, async (req, res) => {
  try {
    const { command, arg } = req.body || {};

    // Validate command is allowlisted
    if (!command || !ALLOWED_CONSOLE_COMMANDS.has(command)) {
      return res.status(400).json({
        ok: false,
        error: `Command not allowed: ${command || "(empty)"}`,
      });
    }

    let result;

    // Gateway lifecycle commands (wrapper-managed, no openclaw CLI)
    if (command === "gateway.restart") {
      await restartGateway();
      result = { code: 0, output: "Gateway restarted successfully\n" };
    } else if (command === "gateway.stop") {
      if (gatewayProc) {
        gatewayProc.kill("SIGTERM");
        gatewayProc = null;
        result = { code: 0, output: "Gateway stopped\n" };
      } else {
        result = { code: 0, output: "Gateway not running\n" };
      }
    } else if (command === "gateway.start") {
      await ensureGatewayRunning();
      result = { code: 0, output: "Gateway started successfully\n" };
    }

    // OpenClaw CLI commands
    else if (command === "openclaw.version") {
      result = await runCmd(OPENCLAW_NODE, clawArgs(["--version"]));
    } else if (command === "openclaw.status") {
      result = await runCmd(OPENCLAW_NODE, clawArgs(["status"]));
    } else if (command === "openclaw.gateway.status") {
      result = await runCmd(OPENCLAW_NODE, clawArgs(["gateway", "status"]));
    } else if (command === "openclaw.channels.status") {
      result = await runCmd(OPENCLAW_NODE, clawArgs(["channels", "status", "--probe"]));
    } else if (command === "openclaw.pairing.list.telegram") {
      result = await runCmd(OPENCLAW_NODE, clawArgs(["pairing", "list", "telegram"]));
    } else if (command === "openclaw.health") {
      result = await runCmd(OPENCLAW_NODE, clawArgs(["health"]));
    } else if (command === "openclaw.doctor") {
      result = await runCmd(OPENCLAW_NODE, clawArgs(["doctor"]));
    } else if (command === "openclaw.logs.tail") {
      // arg is the tail count (default 50)
      const count = arg?.trim() || "50";
      if (!/^\d+$/.test(count)) {
        return res.status(400).json({
          ok: false,
          error: "Invalid tail count (must be a number)",
        });
      }
      result = await runCmd(OPENCLAW_NODE, clawArgs(["logs", "--tail", count]));
    } else if (command === "openclaw.config.get") {
      // arg is the config path (e.g., "gateway.port")
      const cfgPath = arg?.trim();
      if (!cfgPath) {
        return res.status(400).json({
          ok: false,
          error: "Config path required (e.g., gateway.port)",
        });
      }
      result = await runCmd(OPENCLAW_NODE, clawArgs(["config", "get", cfgPath]));
    } else if (command === "openclaw.devices.list") {
      result = await runCmd(OPENCLAW_NODE, clawArgs(["devices", "list"]));
    } else if (command === "openclaw.devices.approve") {
      // arg is the device requestId
      const requestId = arg?.trim();
      if (!requestId) {
        return res.status(400).json({
          ok: false,
          error: "Device requestId required",
        });
      }
      // Validate requestId format (alphanumeric, underscore, dash)
      if (!/^[A-Za-z0-9_-]+$/.test(requestId)) {
        return res.status(400).json({
          ok: false,
          error: "Invalid requestId format (alphanumeric, underscore, dash only)",
        });
      }
      result = await runCmd(OPENCLAW_NODE, clawArgs(["devices", "approve", requestId]));
    } else if (command === "openclaw.plugins.list") {
      result = await runCmd(OPENCLAW_NODE, clawArgs(["plugins", "list"]));
    } else if (command === "openclaw.plugins.enable") {
      // arg is the plugin name
      const pluginName = arg?.trim();
      if (!pluginName) {
        return res.status(400).json({
          ok: false,
          error: "Plugin name required",
        });
      }
      // Validate plugin name format (alphanumeric, underscore, dash)
      if (!/^[A-Za-z0-9_-]+$/.test(pluginName)) {
        return res.status(400).json({
          ok: false,
          error: "Invalid plugin name format (alphanumeric, underscore, dash only)",
        });
      }
      result = await runCmd(OPENCLAW_NODE, clawArgs(["plugins", "enable", pluginName]));
    } else {
      // Should never reach here due to allowlist check
      return res.status(500).json({
        ok: false,
        error: "Internal error: command allowlisted but not implemented",
      });
    }

    // Apply secret redaction to all output
    const output = redactSecrets(result.output || "");

    return res.json({
      ok: result.code === 0,
      output,
      exitCode: result.code,
    });
  } catch (err) {
    console.error("[/setup/api/console/run] error:", err);
    return res.status(500).json({
      ok: false,
      error: `Internal error: ${String(err)}`,
    });
  }
});

app.get("/setup/api/debug", requireSetupAuth, async (_req, res) => {
  const v = await runCmd(OPENCLAW_NODE, clawArgs(["--version"]));
  const help = await runCmd(
    OPENCLAW_NODE,
    clawArgs(["channels", "add", "--help"]),
  );
  res.json({
    wrapper: {
      node: process.version,
      port: PORT,
      stateDir: STATE_DIR,
      workspaceDir: WORKSPACE_DIR,
      configPath: configPath(),
      gatewayTokenFromEnv: Boolean(process.env.OPENCLAW_GATEWAY_TOKEN?.trim()),
      gatewayTokenPersisted: fs.existsSync(
        path.join(STATE_DIR, "gateway.token"),
      ),
      railwayCommit: process.env.RAILWAY_GIT_COMMIT_SHA || null,
    },
    openclaw: {
      entry: OPENCLAW_ENTRY,
      node: OPENCLAW_NODE,
      version: v.output.trim(),
      channelsAddHelpIncludesTelegram: help.output.includes("telegram"),
    },
  });
});

app.post("/setup/api/pairing/approve", requireSetupAuth, async (req, res) => {
  const { channel, code } = req.body || {};
  if (!channel || !code) {
    return res
      .status(400)
      .json({ ok: false, error: "Missing channel or code" });
  }
  const r = await runCmd(
    OPENCLAW_NODE,
    clawArgs(["pairing", "approve", String(channel), String(code)]),
  );
  return res
    .status(r.code === 0 ? 200 : 500)
    .json({ ok: r.code === 0, output: r.output });
});

app.post("/setup/api/reset", requireSetupAuth, async (_req, res) => {
  try {
    fs.rmSync(configPath(), { force: true });
    res
      .type("text/plain")
      .send("OK - deleted config file. You can rerun setup now.");
  } catch (err) {
    res.status(500).type("text/plain").send(String(err));
  }
});

app.post("/setup/api/doctor", requireSetupAuth, async (_req, res) => {
  const args = ["doctor", "--non-interactive", "--repair"];
  const result = await runCmd(OPENCLAW_NODE, clawArgs(args));
  return res.status(result.code === 0 ? 200 : 500).json({
    ok: result.code === 0,
    output: result.output,
  });
});

// ========== WEB TUI ROUTE ==========
app.get("/tui", requireSetupAuth, (_req, res) => {
  if (!ENABLE_WEB_TUI) {
    return res
      .status(403)
      .type("text/plain")
      .send("Web TUI is disabled. Set ENABLE_WEB_TUI=true to enable it.");
  }
  if (!isConfigured()) {
    return res.redirect("/setup");
  }
  res.sendFile(path.join(process.cwd(), "src", "public", "tui.html"));
});

app.get("/setup/export", requireSetupAuth, async (_req, res) => {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });

  res.setHeader("content-type", "application/gzip");
  res.setHeader(
    "content-disposition",
    `attachment; filename="gatherly-agent-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.tar.gz"`,
  );

  // Prefer exporting from a common /data root so archives are easy to inspect and restore.
  // This preserves dotfiles like /data/.openclaw/openclaw.json.
  const stateAbs = path.resolve(STATE_DIR);
  const workspaceAbs = path.resolve(WORKSPACE_DIR);

  const dataRoot = "/data";
  const underData = (p) => p === dataRoot || p.startsWith(dataRoot + path.sep);

  let cwd = "/";
  let paths = [stateAbs, workspaceAbs].map((p) => p.replace(/^\//, ""));

  if (underData(stateAbs) && underData(workspaceAbs)) {
    cwd = dataRoot;
    // We export relative to /data so the archive contains: .openclaw/... and workspace/...
    paths = [
      path.relative(dataRoot, stateAbs) || ".",
      path.relative(dataRoot, workspaceAbs) || ".",
    ];
  }

  const tar = childProcess.spawn(
    "tar",
    ["-czf", "-", "--dereference", ...paths],
    { cwd, stdio: ["ignore", "pipe", "pipe"] },
  );

  tar.stderr.on("data", (d) =>
    console.warn("[export] tar stderr:", d.toString()),
  );
  tar.on("error", (err) => {
    console.error("[export] tar error:", err);
    if (!res.headersSent) res.status(500).end();
  });

  tar.stdout.pipe(res);
});

const proxy = httpProxy.createProxyServer({
  target: GATEWAY_TARGET,
  ws: true,
  xfwd: true,
  proxyTimeout: 120_000,
  timeout: 120_000,
});

// Prevent proxy errors from crashing the wrapper.
// Common errors: ECONNREFUSED (gateway not ready), ECONNRESET (client disconnect).
proxy.on("error", (err, _req, res) => {
  console.error("[proxy]", err);
  if (res && typeof res.headersSent !== "undefined" && !res.headersSent) {
    res.writeHead(503, { "Content-Type": "text/html" });
    try {
      const html = fs.readFileSync(
        path.join(process.cwd(), "src", "public", "loading.html"),
        "utf8",
      );
      res.end(html);
    } catch {
      res.end("Gateway unavailable. Retrying...");
    }
  }
});

proxy.on("proxyReq", (proxyReq, req, res) => {
  proxyReq.setHeader("Authorization", `Bearer ${OPENCLAW_GATEWAY_TOKEN}`);
});

proxy.on("proxyReqWs", (proxyReq, req, socket, options, head) => {
  proxyReq.setHeader("Authorization", `Bearer ${OPENCLAW_GATEWAY_TOKEN}`);
});

// Auto-inject token into /openclaw browser GET requests so the Control UI works
// without the user needing to know the gateway token.
app.use((req, res, next) => {
  if (
    req.method === "GET" &&
    (req.path === "/openclaw" || req.path.startsWith("/openclaw/")) &&
    !req.query.token &&
    !req.headers.authorization &&
    !req.headers.upgrade // not a WebSocket upgrade
  ) {
    const sep = req.url.includes("?") ? "&" : "?";
    return res.redirect(307, `${req.url}${sep}token=${encodeURIComponent(OPENCLAW_GATEWAY_TOKEN)}`);
  }
  return next();
});

app.use(async (req, res) => {
  if (!isConfigured() && !req.path.startsWith("/setup")) {
    return res.redirect("/setup");
  }

  if (isConfigured()) {
    if (!isGatewayReady()) {
      try {
        await ensureGatewayRunning();
      } catch {
        return res
          .status(503)
          .sendFile(path.join(process.cwd(), "src", "public", "loading.html"));
      }

      if (!isGatewayReady()) {
        return res
          .status(503)
          .sendFile(path.join(process.cwd(), "src", "public", "loading.html"));
      }
    }
  }

  if (req.path === "/openclaw" && !req.query.token) {
    return res.redirect(`/openclaw?token=${OPENCLAW_GATEWAY_TOKEN}`);
  }

  return proxy.web(req, res, { target: GATEWAY_TARGET });
});

const server = app.listen(PORT, () => {
  console.log(`[wrapper] listening on port ${PORT}`);
  console.log(`[wrapper] setup wizard: http://localhost:${PORT}/setup`);
  console.log(`[wrapper] web TUI: ${ENABLE_WEB_TUI ? "enabled" : "disabled"}`);
  console.log(`[wrapper] doctor on boot: ${RUN_DOCTOR_ON_BOOT ? "enabled" : "disabled"}`);
  console.log(`[wrapper] configured: ${isConfigured()}`);

  // Harden state dir for OpenClaw and avoid missing credentials dir on fresh volumes.
  try {
    fs.mkdirSync(path.join(STATE_DIR, "credentials"), { recursive: true, mode: 0o700 });
  } catch {}
  try {
    fs.chmodSync(STATE_DIR, 0o700);
  } catch {}
  try {
    fs.chmodSync(path.join(STATE_DIR, "credentials"), 0o700);
  } catch {}

  // Auto-configure from env vars if not yet configured, then start the gateway.
  (async () => {
    if (!isConfigured()) {
      try {
        await autoConfigureIfNeeded();
      } catch (err) {
        console.error(`[auto-config] failed: ${err.message}`);
      }
    }

    // Auto-start the gateway if configured (either pre-existing or just auto-configured)
    if (isConfigured()) {
      if (RUN_DOCTOR_ON_BOOT) {
        try {
          console.log("[wrapper] running openclaw doctor --fix...");
          const dr = await runCmd(OPENCLAW_NODE, clawArgs(["doctor", "--fix"]));
          console.log(`[wrapper] doctor --fix exit=${dr.code}`);
          if (dr.output) console.log(dr.output);
        } catch (err) {
          console.warn(`[wrapper] doctor --fix failed: ${err.message}`);
        }
      }
      await ensureGatewayRunning();
    }
  })().catch((err) => {
    console.error(`[wrapper] failed to start gateway at boot: ${err.message}`);
  });
});

const tuiWss = createTuiWebSocketServer(server);

server.on("upgrade", async (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/tui/ws") {
    if (!ENABLE_WEB_TUI) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    if (!verifyTuiAuth(req)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Basic realm=\"Gatherly Assistant Terminal\"\r\n\r\n");
      socket.destroy();
      return;
    }

    if (activeTuiSession) {
      socket.write("HTTP/1.1 409 Conflict\r\n\r\n");
      socket.destroy();
      return;
    }

    tuiWss.handleUpgrade(req, socket, head, (ws) => {
      tuiWss.emit("connection", ws, req);
    });
    return;
  }

  if (!isConfigured()) {
    socket.destroy();
    return;
  }
  try {
    await ensureGatewayRunning();
  } catch (err) {
    console.warn(`[websocket] gateway not ready: ${err.message}`);
    socket.destroy();
    return;
  }
  proxy.ws(req, socket, head, { target: GATEWAY_TARGET });
});

async function gracefulShutdown(signal) {
  console.log(`[wrapper] received ${signal}, shutting down`);
  shuttingDown = true;

  if (setupRateLimiter.cleanupInterval) {
    clearInterval(setupRateLimiter.cleanupInterval);
  }

  if (activeTuiSession) {
    try {
      activeTuiSession.ws.close(1001, "Server shutting down");
      if (activeTuiSession.pty) activeTuiSession.pty.kill();
    } catch {}
    activeTuiSession = null;
  }

  server.close();

  if (gatewayProc) {
    try {
      gatewayProc.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => gatewayProc.on("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
      if (gatewayProc && !gatewayProc.killed) {
        gatewayProc.kill("SIGKILL");
      }
    } catch (err) {
      console.warn(`[wrapper] error killing gateway: ${err.message}`);
    }
  }

  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
