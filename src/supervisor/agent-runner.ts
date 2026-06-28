import { runCodexTurn } from "../codex";
import { extractBlockedReason, extractFailureSignature, extractStateHint } from "../core/turn-output-parser";
import { CodexPromptBuilder } from "../executors/prompt-builder";
import type { PromptBuilder } from "../executors/types";
import { truncatePreservingStartAndEnd } from "../core/utils";
import type { FailureContext, FailureKind, SupervisorConfig } from "../core/types";
import { buildCodexFailureContext, classifyFailure, classifyTurnError } from "./supervisor-failure-helpers";
import { basename } from "node:path";
// The agent turn contract lives in ../agent-contract so the executor layer can
// depend on it without importing this higher-level supervisor module. Re-export
// the types here for backward compatibility with existing import sites.
import type {
  AgentRunner,
  AgentRunnerCapabilities,
  AgentTurnContext,
  AgentTurnResult,
  AgentTurnStructuredResult,
} from "../agent-contract";
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

export interface CreateCodexAgentRunnerOptions {
  runCodexTurnImpl?: typeof runCodexTurn;
  classifyFailureImpl?: typeof classifyFailure;
  buildFailureContextImpl?: typeof buildCodexFailureContext;
  probeCapabilitiesImpl?: (config?: SupervisorConfig) => AgentRunnerCapabilities;
  config?: SupervisorConfig;
  /**
   * Prompt builder for constructing the supervisor prompt.
   * Defaults to CodexPromptBuilder (passthrough to buildCodexPrompt).
   * @since Phase 6
   */
  promptBuilder?: PromptBuilder;
}

export function detectCodexCliCapabilities(
  config?: Pick<SupervisorConfig, "codexBinary" | "executorKind"> | null,
): AgentRunnerCapabilities {
  // An explicit executorKind proves the CLI even when the binary is an alias
  // (e.g. "/usr/local/bin/cx"); otherwise fall back to the binary name.
  const binaryName = basename(config?.codexBinary ?? "codex").toLowerCase();
  const looksLikeCodex = config?.executorKind === "codex" || binaryName.includes("codex");

  return {
    supportsResume: looksLikeCodex,
    supportsStructuredResult: looksLikeCodex,
  };
}

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

function buildCodexExitFailureContext(
  buildFailureContextImpl: typeof buildCodexFailureContext,
  message: string,
  stderr: string,
  stdout: string,
): FailureContext {
  return buildFailureContextImpl(
    "codex",
    "Codex exited non-zero.",
    [truncatePreservingStartAndEnd([message, stderr, stdout].filter(Boolean).join("\n"), 2000) ?? "Unknown failure output"],
  );
}

export function createCodexAgentRunner(options: CreateCodexAgentRunnerOptions = {}): AgentRunner {
  const runCodexTurnImpl = options.runCodexTurnImpl ?? runCodexTurn;
  const classifyFailureImpl = options.classifyFailureImpl ?? classifyFailure;
  const buildFailureContextImpl = options.buildFailureContextImpl ?? buildCodexFailureContext;
  const capabilities = (options.probeCapabilitiesImpl ?? detectCodexCliCapabilities)(options.config);
  const promptBuilder = options.promptBuilder ?? new CodexPromptBuilder();

  return {
    capabilities,
    async runTurn(context): Promise<AgentTurnResult> {
      try {
        const prompt = promptBuilder.buildPrompt(context);
        const result = await runCodexTurnImpl(
          context.config,
          context.workspacePath,
          prompt,
          context.state,
          context.record,
          context.kind === "resume" ? context.sessionId : undefined,
        );
        const failureKind: FailureKind = result.exitCode === 0 ? null : "codex_exit";
        const structuredResult = failureKind === null ? parseAgentTurnStructuredResult(result.lastMessage) : null;

        return {
          exitCode: result.exitCode,
          sessionId: result.sessionId,
          supervisorMessage: result.lastMessage,
          stderr: result.stderr,
          stdout: result.stdout,
          structuredResult,
          failureKind,
          failureContext:
            failureKind === null
              ? null
              : buildCodexExitFailureContext(
                  buildFailureContextImpl,
                  result.lastMessage,
                  result.stderr,
                  result.stdout,
                ),
        };
      } catch (error) {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        return {
          exitCode: 1,
          sessionId: context.kind === "resume" ? context.sessionId : null,
          supervisorMessage: "",
          stderr: message,
          stdout: "",
          structuredResult: null,
          failureKind: classifyTurnError(error, message, classifyFailureImpl),
          failureContext: buildFailureContextImpl("codex", "Codex turn execution failed.", [
            truncatePreservingStartAndEnd(message, 2000) ?? "Unknown failure",
          ]),
        };
      }
    },
  };
}
