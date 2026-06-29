/**
 * Phase 4: OpenCodeExecutor — adapter for the OpenCode CLI.
 *
 * Wraps the OpenCode CLI (`opencode run`) into the provider-neutral
 * Executor interface, using:
 * - `opencode run` for non-interactive mode
 * - `--format json` for JSON event output (session ID + assistant message)
 * - `--session <id>` for resume
 * - `--model provider/model` for model selection
 * - `--variant` for reasoning effort control (provider-specific)
 * - `--dangerously-skip-permissions` for autonomous operation
 *
 * The executor reuses the same prompt format and structured-result
 * parsing as CodexExecutor, maintaining behavioral parity for the
 * supervisor's state machine.
 */

import { basename } from "node:path";
import type {
  AgentRunner,
  AgentTurnContext,
  AgentTurnResult,
} from "../agent-contract";
import type {
  Executor,
  ExecutorCapabilities,
} from "./types";
import type {
  SupervisorConfig,
  RunState,
  IssueRunRecord,
} from "../core/types";
import { resolveExecutorTurnTimeoutMinutes } from "../core/config-types";
import {
  createExecutorAgentRunner,
  runExecutorCliCommand,
  type ExecutorTurnResult,
  type RunExecutorTurnFn,
} from "./executor-runner";
import { classifyFailure, buildCodexFailureContext } from "../supervisor/supervisor-failure-helpers";
import { GenericPromptBuilder } from "./prompt-builder";
import type { PromptBuilder } from "./types";

/**
 * Detect OpenCode CLI capabilities from the binary name.
 */
export function detectOpenCodeCapabilities(
  config?: Pick<SupervisorConfig, "executorBinary" | "executorKind"> | null,
): { supportsResume: boolean; supportsStructuredResult: boolean } {
  // An explicit executorKind proves the provider even when the binary is an
  // alias (e.g. "/usr/local/bin/oc"); otherwise fall back to the binary name.
  const binaryName = basename(config?.executorBinary ?? "opencode").toLowerCase();
  const looksLikeOpenCode = config?.executorKind === "opencode" || binaryName.includes("opencode");

  return {
    supportsResume: looksLikeOpenCode,
    supportsStructuredResult: looksLikeOpenCode,
  };
}

/**
 * Build CLI arguments for an OpenCode turn.
 *
 * Uses `opencode run` with:
 * - `--format json` for machine-readable output
 * - `--model provider/model` when a model is configured
 * - `--session <id>` for resume (or `--continue` for last session)
 * - `--dangerously-skip-permissions` for autonomous operation
 * - `--dir <workspace>` for workspace isolation
 */
export function buildOpenCodeArgs(
  config: SupervisorConfig,
  workspacePath: string,
  prompt: string,
  state?: RunState,
  sessionId?: string | null,
): string[] {
  const args: string[] = ["run", "--format", "json"];

  // Model selection — OpenCode uses provider/model format
  const model = resolveOpenCodeModel(config);
  if (model) {
    args.push("--model", model);
  }

  // Reasoning variant (provider-specific effort)
  const variant = resolveOpenCodeVariant(config, state);
  if (variant) {
    args.push("--variant", variant);
  }

  // Session management
  if (sessionId) {
    args.push("--session", sessionId);
  }

  // OpenCode runs autonomously: operator_gated is rejected at config load
  // (config-validation), because OpenCode's permission enforcement is layered on
  // extensible, overridable config (agents/OPENCODE_PERMISSION/custom tools/
  // plugins/MCP startup) that the supervisor cannot reliably gate. Only the Codex
  // executor's OS sandbox provides a guaranteed non-interactive gate.
  args.push("--dangerously-skip-permissions");

  // Workspace directory
  args.push("--dir", workspacePath);

  // Prompt (positional argument)
  args.push(prompt);

  return args;
}

/**
 * Resolve the model for OpenCode from config.
 * Uses codexModel as a fallback since the config field is shared.
 */
function resolveOpenCodeModel(config: Pick<SupervisorConfig, "codexModel" | "codexModelStrategy">): string | null {
  if (config.codexModelStrategy === "fixed" && config.codexModel) {
    return config.codexModel;
  }
  // For "inherit" strategy, let OpenCode use its default model
  return null;
}

/**
 * Resolve reasoning effort variant for OpenCode.
 * Maps the codexReasoningEffortByState to OpenCode's --variant flag.
 */
function resolveOpenCodeVariant(
  config: Pick<SupervisorConfig, "codexReasoningEffortByState">,
  state?: RunState,
): string | null {
  if (!state) {
    return null;
  }
  const effort = config.codexReasoningEffortByState?.[state];
  if (!effort) {
    return null;
  }
  // OpenCode uses provider-specific variant strings.
  // Map our reasoning effort levels to a generic variant name.
  // The actual mapping is provider-specific; we pass the effort level directly.
  return effort;
}

/**
 * Run an OpenCode CLI turn.
 *
 * Invokes `opencode run --format json` and parses the JSON output
 * to extract the session ID and last assistant message.
 */
export const runOpenCodeTurn: RunExecutorTurnFn = async (
  config,
  workspacePath,
  prompt,
  state,
  _record,
  sessionId,
): Promise<ExecutorTurnResult> => {
  const args = buildOpenCodeArgs(config, workspacePath, prompt, state, sessionId);
  const timeoutMs = resolveExecutorTurnTimeoutMinutes(config) * 60_000;

  return runExecutorCliCommand(config.executorBinary, args, {
    cwd: workspacePath,
    timeoutMs,
    sessionId,
    parseJsonOutput: true,
    env: {
      ...process.env,
      CI: "1",
    },
  });
};

/**
 * Options for constructing an OpenCodeExecutor.
 */
export interface OpenCodeExecutorOptions {
  config: SupervisorConfig;
  /** Optional pre-existing runner to wrap (skips internal runner creation). */
  runner?: AgentRunner;
  /** Override for the turn implementation (test injection). */
  runTurnImpl?: RunExecutorTurnFn;
  /** Override for capability detection (test injection). */
  probeCapabilitiesImpl?: typeof detectOpenCodeCapabilities;
  /** Override for failure classification (test injection). */
  classifyFailureImpl?: typeof classifyFailure;
  /** Override for failure context building (test injection). */
  buildFailureContextImpl?: typeof buildCodexFailureContext;
  /** Override for prompt builder (defaults to GenericPromptBuilder("OpenCode")). @since Phase 6 */
  promptBuilder?: PromptBuilder;
}

/**
 * OpenCode executor adapter.
 *
 * Wraps the OpenCode CLI into the provider-neutral Executor interface.
 * Delegates runTurn to an internally created AgentRunner, following
 * the same pattern as CodexExecutor.
 *
 * Capabilities:
 * - supportsResume: true (via --session)
 * - supportsStructuredResult: true (same labeled output format)
 * - supportsReasoningControl: true (via --variant)
 */
export class OpenCodeExecutor implements Executor {
  readonly capabilities: ExecutorCapabilities;
  private readonly runner: AgentRunner;

  constructor(options: OpenCodeExecutorOptions) {
    const baseCaps = (options.probeCapabilitiesImpl ?? detectOpenCodeCapabilities)(
      options.config,
    );

    this.runner = options.runner ?? createExecutorAgentRunner({
      config: options.config,
      runTurnImpl: options.runTurnImpl ?? runOpenCodeTurn,
      capabilities: baseCaps,
      classifyFailureImpl: options.classifyFailureImpl,
      buildFailureContextImpl: options.buildFailureContextImpl,
      exitFailureKind: "command_error",
      failureCategory: "executor", // Executor-neutral category (not Codex-specific)
      providerName: "OpenCode",
      promptBuilder: options.promptBuilder ?? new GenericPromptBuilder("OpenCode"),
    });

    this.capabilities = {
      supportsResume: this.runner.capabilities.supportsResume,
      supportsStructuredResult: this.runner.capabilities.supportsStructuredResult,
      supportsReasoningControl: true, // OpenCode supports --variant
    };
  }

  async runTurn(context: AgentTurnContext): Promise<AgentTurnResult> {
    return this.runner.runTurn(context);
  }
}
