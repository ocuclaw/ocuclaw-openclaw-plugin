import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sanitizeConnectReason } from "./sanitize-connect-reason.ts";

describe("sanitizeConnectReason", () => {
  it("redacts token= / authorization= key-value secrets", () => {
    assert.equal(
      sanitizeConnectReason("connect ws://h/?token=abc123def failed"),
      "connect ws://h/?token=[REDACTED] failed",
    );
    assert.equal(sanitizeConnectReason("authorization=Bearerxyz"), "authorization=[REDACTED]");
  });

  it("redacts a bearer credential", () => {
    assert.equal(sanitizeConnectReason("got bearer shorttok here"), "got bearer [REDACTED] here");
  });

  it("redacts a long credential-shaped run (jwt / signature / nonce)", () => {
    const jwt = "a".repeat(60);
    assert.equal(sanitizeConnectReason(`sig ${jwt}`), "sig [REDACTED]");
  });

  it("passes a benign reason through unchanged", () => {
    assert.equal(sanitizeConnectReason("Unexpected server response: 1008"), "Unexpected server response: 1008");
    assert.equal(sanitizeConnectReason("first request must be connect"), "first request must be connect");
  });

  it("handles null/undefined and caps length at 300", () => {
    assert.equal(sanitizeConnectReason(null), "");
    assert.equal(sanitizeConnectReason(undefined), "");
    assert.equal(sanitizeConnectReason("ok ".repeat(200)).length, 300);
  });
});
