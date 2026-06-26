/**
 * Phase 6: Tests for provider-neutral resume policy.
 *
 * Verifies shouldUseCompactResumePrompt behavior is unchanged after
 * moving from src/codex/codex-prompt.ts to src/core/resume-policy.ts.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { shouldUseCompactResumePrompt } from "./resume-policy";

test("shouldUseCompactResumePrompt returns true for handoff-driven states", () => {
  assert.equal(shouldUseCompactResumePrompt("planning"), true);
  assert.equal(shouldUseCompactResumePrompt("reproducing"), true);
  assert.equal(shouldUseCompactResumePrompt("implementing"), true);
  assert.equal(shouldUseCompactResumePrompt("stabilizing"), true);
  assert.equal(shouldUseCompactResumePrompt("draft_pr"), true);
});

test("shouldUseCompactResumePrompt returns false for non-handoff-driven states", () => {
  assert.equal(shouldUseCompactResumePrompt("repairing_ci"), false);
  assert.equal(shouldUseCompactResumePrompt("local_review_fix"), false);
  assert.equal(shouldUseCompactResumePrompt("addressing_review"), false);
  assert.equal(shouldUseCompactResumePrompt("local_review"), false);
  assert.equal(shouldUseCompactResumePrompt("pr_open"), false);
  assert.equal(shouldUseCompactResumePrompt("waiting_ci"), false);
  assert.equal(shouldUseCompactResumePrompt("ready_to_merge"), false);
  assert.equal(shouldUseCompactResumePrompt("merging"), false);
  assert.equal(shouldUseCompactResumePrompt("done"), false);
  assert.equal(shouldUseCompactResumePrompt("blocked"), false);
  assert.equal(shouldUseCompactResumePrompt("failed"), false);
});

test("shouldUseCompactResumePrompt re-export from codex-prompt.ts is backward compatible", async () => {
  // Verify the re-export still works
  const codexModule = await import("../codex/codex-prompt");
  assert.equal(typeof codexModule.shouldUseCompactResumePrompt, "function");
  assert.equal(codexModule.shouldUseCompactResumePrompt("planning"), true);
  assert.equal(codexModule.shouldUseCompactResumePrompt("addressing_review"), false);
});
