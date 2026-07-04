import assert from "node:assert/strict";
import test from "node:test";
import { constantTimeEqual } from "./constant-time-equal.ts";

test("constantTimeEqual: equal non-empty strings compare equal", () => {
  assert.equal(constantTimeEqual("s3cr3t-token", "s3cr3t-token"), true);
  assert.equal(constantTimeEqual("a", "a"), true);
});

test("constantTimeEqual: any difference compares unequal", () => {
  assert.equal(constantTimeEqual("s3cr3t-token", "s3cr3t-toke"), false);
  assert.equal(constantTimeEqual("s3cr3t-token", "s3cr3t-tokeN"), false);
  assert.equal(constantTimeEqual("abc", "xbc"), false);
});

test("constantTimeEqual: length mismatch never throws (hashed to fixed width)", () => {
  assert.doesNotThrow(() => constantTimeEqual("short", "a much much longer candidate value"));
  assert.equal(constantTimeEqual("short", "a much much longer candidate value"), false);
});

test("constantTimeEqual: non-string or empty inputs are always false", () => {
  assert.equal(constantTimeEqual("", ""), false);
  assert.equal(constantTimeEqual("x", ""), false);
  assert.equal(constantTimeEqual(null, "x"), false);
  assert.equal(constantTimeEqual("x", undefined), false);
  assert.equal(constantTimeEqual(undefined, undefined), false);
  assert.equal(constantTimeEqual(123, 123), false);
});
