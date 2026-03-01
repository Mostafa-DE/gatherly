export const GATHERLY_TRPC_ALLOWED_PROCEDURES = new Set([
  "plugin.assistant.getCapabilities",
  "plugin.assistant.getActivities",
  "plugin.assistant.getSessions",
  "plugin.assistant.searchSessions",
  "plugin.assistant.getParticipants",
  "plugin.assistant.getMemberSummary",
  "plugin.assistant.submitMarkAttendance",
  "plugin.assistant.submitRecordMatch",
  "plugin.assistant.submitMarkPayment",
  "plugin.assistant.submitAddNote",
  "plugin.assistant.submitAddParticipant",
  "plugin.assistant.submitRemoveParticipant",
]);

export function normalizeTelegramUserId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/^(tg:|telegram:)/i, "").trim();
  return /^\d+$/.test(normalized) ? normalized : null;
}

export function isLoopbackAddress(remoteAddress) {
  const remote = String(remoteAddress ?? "");
  return (
    remote === "127.0.0.1" ||
    remote === "::1" ||
    remote === "::ffff:127.0.0.1"
  );
}

export function isLoopbackRequest(req) {
  return isLoopbackAddress(req?.socket?.remoteAddress);
}

export function extractTelegramUserIdFromTrpcRequest(req) {
  if (req?.method === "GET") {
    const rawInput = Array.isArray(req.query?.input)
      ? req.query.input[0]
      : req.query?.input;
    if (typeof rawInput !== "string") return null;
    try {
      const parsed = JSON.parse(rawInput);
      return normalizeTelegramUserId(parsed?.json?.telegramUserId);
    } catch {
      return null;
    }
  }

  if (req?.method === "POST") {
    const envelope = req.body;
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
      return null;
    }
    return normalizeTelegramUserId(envelope?.json?.telegramUserId);
  }

  return null;
}

export function buildRelayHeaders({
  primarySecret,
  secondSecret,
  telegramUserId,
  method,
  nonceFactory = () => globalThis.crypto.randomUUID(),
}) {
  const headers = {
    Authorization: `Bearer ${primarySecret}`,
    "X-Bot-Secret": secondSecret,
    "X-Bot-User-Id": telegramUserId,
    "X-Bot-Nonce": nonceFactory(),
  };

  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}
