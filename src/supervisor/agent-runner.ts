import { extractBlockedReason, extractFailureSignature, extractStateHint } from "../core/turn-output-parser";
// The agent turn contract lives in ../agent-contract so the executor layer can
// depend on it without importing this higher-level supervisor module. Re-export
// the types here for backward compatibility with existing import sites.
import type { AgentTurnStructuredResult } from "../agent-contract";
export type {
  AgentRunner,
  AgentRunnerCapabilities,
  AgentTurnContext,
  AgentTurnRequest,
  AgentTurnResult,
  AgentTurnStructuredResult,
  ResumeAgentTurnContext,
  StartAgentTurnContext,
} from "../agent-contract";

function extractLabeledValue(message: string, label: string): string | null {
  const match = message.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
  if (!match) {
    return null;
  }

  const value = match[1]?.trim();
  if (!value || value.toLowerCase() === "none") {
    return null;
  }

  return value;
}

export function parseAgentTurnStructuredResult(message: string): AgentTurnStructuredResult | null {
  const summary = extractLabeledValue(message, "Summary");
  const stateHint = extractStateHint(message);
  const blockedReason = stateHint === "blocked" ? extractBlockedReason(message) : null;
  const failureSignature =
    stateHint === "blocked" || stateHint === "failed" ? extractFailureSignature(message) : null;
  const tests = extractLabeledValue(message, "Tests");
  const nextAction = extractLabeledValue(message, "Next action");

  if (!summary && !stateHint && !blockedReason && !failureSignature && !tests && !nextAction) {
    return null;
  }

  return {
    summary: summary ?? "",
    stateHint,
    blockedReason,
    failureSignature,
    nextAction,
    tests,
  };
}
