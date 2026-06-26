/**
 * Phase 6: Provider-neutral resume policy.
 *
 * Determines whether a compact resume prompt should be used for a given state.
 * This is a supervisor-level policy decision, not a provider-specific one.
 *
 * Moved from src/codex/codex-prompt.ts — the only dependency is RunState
 * from core/types, with no Codex-specific logic.
 */

import type { RunState } from "./types";

const COMPACT_RESUME_PROMPT_STATES = new Set<RunState>([
  "planning",
  "reproducing",
  "implementing",
  "stabilizing",
  "draft_pr",
]);

export function shouldUseCompactResumePrompt(state: RunState): boolean {
  return COMPACT_RESUME_PROMPT_STATES.has(state);
}
