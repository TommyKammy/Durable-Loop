/**
 * Phase 6: Tests for provider-neutral turn output parser.
 *
 * Verifies the output parser functions are unchanged after moving
 * from src/codex/codex-output-parser.ts to src/core/turn-output-parser.ts.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { extractStateHint, extractBlockedReason, extractFailureSignature } from "./turn-output-parser";

test("extractStateHint accepts supported states", () => {
  assert.equal(extractStateHint("State hint: local_review_fix"), "local_review_fix");
  assert.equal(extractStateHint("State hint: blocked"), "blocked");
  assert.equal(extractStateHint("State hint: implementing"), "implementing");
  assert.equal(extractStateHint("State hint: done"), "done");
});

test("extractStateHint rejects unsupported states", () => {
  assert.equal(extractStateHint("State hint: clarification"), null);
  assert.equal(extractStateHint("No state footer"), null);
  assert.equal(extractStateHint(""), null);
});

test("extractBlockedReason accepts supported blocked reasons", () => {
  assert.equal(extractBlockedReason("Blocked reason: verification"), "verification");
  assert.equal(extractBlockedReason("Blocked reason: manual_pr_closed"), "manual_pr_closed");
  assert.equal(extractBlockedReason("Blocked reason: requirements"), "requirements");
});

test("extractBlockedReason rejects unsupported blocked reasons", () => {
  assert.equal(extractBlockedReason("Blocked reason: clarification"), null);
  assert.equal(extractBlockedReason("No blocked reason footer"), null);
  assert.equal(extractBlockedReason(""), null);
});

test("extractFailureSignature normalizes empty and none values", () => {
  assert.equal(extractFailureSignature("Failure signature: none"), null);
  assert.equal(extractFailureSignature("Failure signature:    "), null);
  assert.equal(extractFailureSignature("No failure signature footer"), null);
});

test("extractFailureSignature trims and truncates values", () => {
  assert.equal(extractFailureSignature("Failure signature:  prior-check  "), "prior-check");
  const longSignature = "Failure signature: " + "x".repeat(600);
  assert.equal(extractFailureSignature(longSignature), "x".repeat(500));
});

test("output parser functions are re-exported from codex-output-parser.ts", async () => {
  // Verify backward compatibility re-export
  const codexModule = await import("../codex/codex-output-parser");
  assert.equal(typeof codexModule.extractStateHint, "function");
  assert.equal(typeof codexModule.extractBlockedReason, "function");
  assert.equal(typeof codexModule.extractFailureSignature, "function");
});
