import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRelayHeaders,
  extractTelegramUserIdFromTrpcRequest,
  GATHERLY_TRPC_ALLOWED_PROCEDURES,
  isLoopbackAddress,
  isLoopbackRequest,
} from "../gatherly-relay.js";

describe("gatherly relay security helpers", () => {
  it("allows only the expected assistant procedures", () => {
    assert.equal(
      GATHERLY_TRPC_ALLOWED_PROCEDURES.has("plugin.assistant.getCapabilities"),
      true
    );
    assert.equal(
      GATHERLY_TRPC_ALLOWED_PROCEDURES.has("plugin.assistant.submitAddNote"),
      true
    );
    assert.equal(
      GATHERLY_TRPC_ALLOWED_PROCEDURES.has("plugin.assistant.approveFromDashboard"),
      false
    );
    assert.equal(
      GATHERLY_TRPC_ALLOWED_PROCEDURES.has("plugin.user.getById"),
      false
    );
  });

  it("identifies loopback addresses safely", () => {
    assert.equal(isLoopbackAddress("127.0.0.1"), true);
    assert.equal(isLoopbackAddress("::1"), true);
    assert.equal(isLoopbackAddress("::ffff:127.0.0.1"), true);
    assert.equal(isLoopbackAddress("10.1.2.3"), false);
    assert.equal(isLoopbackAddress("::ffff:10.1.2.3"), false);
  });

  it("checks loopback requests via req.socket.remoteAddress", () => {
    assert.equal(
      isLoopbackRequest({ socket: { remoteAddress: "127.0.0.1" } }),
      true
    );
    assert.equal(
      isLoopbackRequest({ socket: { remoteAddress: "10.9.0.5" } }),
      false
    );
  });

  it("extracts telegramUserId from GET query envelope", () => {
    const request = {
      method: "GET",
      query: {
        input: JSON.stringify({
          json: { telegramUserId: "telegram:12345" },
        }),
      },
    };
    assert.equal(extractTelegramUserIdFromTrpcRequest(request), "12345");
  });

  it("extracts telegramUserId from POST mutation envelope", () => {
    const request = {
      method: "POST",
      body: { json: { telegramUserId: "tg:67890" } },
    };
    assert.equal(extractTelegramUserIdFromTrpcRequest(request), "67890");
  });

  it("rejects malformed or missing telegramUserId", () => {
    assert.equal(
      extractTelegramUserIdFromTrpcRequest({
        method: "GET",
        query: { input: "not-json" },
      }),
      null
    );

    assert.equal(
      extractTelegramUserIdFromTrpcRequest({
        method: "POST",
        body: { json: { telegramUserId: "abc123" } },
      }),
      null
    );
  });

  it("builds secure relay headers for GET and POST", () => {
    const nonceValues = ["nonce_one", "nonce_two"];
    let nonceIndex = 0;
    const nonceFactory = () => nonceValues[nonceIndex++];

    const getHeaders = buildRelayHeaders({
      primarySecret: "primary_secret",
      secondSecret: "secondary_secret",
      telegramUserId: "111222",
      method: "GET",
      nonceFactory,
    });

    assert.equal(getHeaders.Authorization, "Bearer primary_secret");
    assert.equal(getHeaders["X-Bot-Secret"], "secondary_secret");
    assert.equal(getHeaders["X-Bot-User-Id"], "111222");
    assert.equal(getHeaders["X-Bot-Nonce"], "nonce_one");
    assert.equal(Object.hasOwn(getHeaders, "Content-Type"), false);

    const postHeaders = buildRelayHeaders({
      primarySecret: "primary_secret",
      secondSecret: "secondary_secret",
      telegramUserId: "111222",
      method: "POST",
      nonceFactory,
    });

    assert.equal(postHeaders["X-Bot-Nonce"], "nonce_two");
    assert.equal(postHeaders["Content-Type"], "application/json");
  });
});
