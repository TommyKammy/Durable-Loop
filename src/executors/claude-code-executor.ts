/**
 * Phase 4: ClaudeCodeExecutor — adapter for the Claude Code CLI.
 *
 * Wraps the Claude Code CLI (`claude -p`) into the provider-neutral
 * Executor interface, using:
 * - `claude -p` for non-interactive print mode
 * - `--output-format json` for JSON output (session ID + result text)
 * - `--resume <session-id>` for resume (or `--continue` / `-c` for last session)
 * - `--model <model>` for model selection
 * - `--effort <level>` for reasoning effort control
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
} from "../supervisor/agent-runner";
import type {
  Executor,
  ExecutorCapabilities,
} from "./types";
import type {
  SupervisorConfig,
  RunState,
} from "../core/types";
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
 * Detect Claude Code CLI capabilities from the binary name.
 */
export function detectClaudeCodeCapabilities(
  config?: Pick<SupervisorConfig, "codexBinary"> | null,
): { supportsResume: boolean; supportsStructuredResult: boolean } {
  const binaryName = basename(config?.codexBinary ?? "claude").toLowerCase();
  const looksLikeClaude = binaryName.includes("claude");

  return {
    supportsResume: looksLikeClaude,
    supportsStructuredResult: looksLikeClaude,
  };
}

/**
 * Build CLI arguments for a Claude Code turn.
 *
 * Uses `claude -p` with:
 * - `--output-format json` for machine-readable output
 * - `--model <model>` when a model is configured
 * - `--effort <level>` for reasoning effort control
 * - `--resume <session-id>` for resume (or `--continue` / `-c` for last session)
 * - `--dangerously-skip-permissions` for autonomous operation
 * - `--add-dir <workspace>` for workspace access
 */
function buildClaudeCodeArgs(
  config: SupervisorConfig,
  workspacePath: string,
  prompt: string,
  state: RunState,
  sessionId?: string | null,
): string[] {
  const args: string[] = ["-p", "--output-format", "json"];

  // Model selection
  const model = resolveClaudeCodeModel(config);
  if (model) {
    args.push("--model", model);
  }

  // Reasoning effort via --effort flag
  const effort = resolveClaudeCodeEffort(config, state);
  if (effort) {
    args.push("--effort", effort);
  }

  // Session management
  if (sessionId) {
    args.push("--resume", sessionId);
  }

  // Autonomous permissions
  args.push("--dangerously-skip-permissions");

  // Workspace directory access
  args.push("--add-dir", workspacePath);

  // Prompt (positional argument)
  args.push(prompt);

  return args;
}

/**
 * Resolve the model for Claude Code from config.
 * Uses codexModel as a fallback since the config field is shared.
 */
function resolveClaudeCodeModel(
  config: Pick<SupervisorConfig, "codexModel" | "codexModelStrategy">,
): string | null {
  if (config.codexModelStrategy === "fixed" && config.codexModel) {
    return config.codexModel;
  }
  // For "inherit" strategy, let Claude Code use its default model
  return null;
}

/**
 * Resolve reasoning effort for Claude Code.
 * Maps our reasoning effort levels to Claude Code's --effort flag.
 *
 * Claude Code supports: "low", "medium", "high"
 * Our ReasoningEffort type: "low" | "medium" | "high"
 */
function resolveClaudeCodeEffort(
  config: Pick<SupervisorConfig, "codexReasoningEffortByState">,
  state: RunState,
): string | null {
  const effort = config.codexReasoningEffortByState?.[state];
  if (!effort) {
    return null;
  }
  return effort;
}

/**
 * Run a Claude Code CLI turn.
 *
 * Invokes `claude -p --output-format json` and parses the JSON output
 * to extract the session ID and last assistant message.
 */
export const runClaudeCodeTurn: RunExecutorTurnFn = async (
  config,
  workspacePath,
  prompt,
  state,
  _record,
  sessionId,
): Promise<ExecutorTurnResult> => {
  const args = buildClaudeCodeArgs(config, workspacePath, prompt, state, sessionId);
  const timeoutMs = config.codexExecTimeoutMinutes * 60_000;

  return runExecutorCliCommand(config.codexBinary, args, {
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
 * Options for constructing a ClaudeCodeExecutor.
 */
export interface ClaudeCodeExecutorOptions {
  config: SupervisorConfig;
  /** Optional pre-existing runner to wrap (skips internal runner creation). */
  runner?: AgentRunner;
  /** Override for the turn implementation (test injection). */
  runTurnImpl?: RunExecutorTurnFn;
  /** Override for capability detection (test injection). */
  probeCapabilitiesImpl?: typeof detectClaudeCodeCapabilities;
  /** Override for failure classification (test injection). */
  classifyFailureImpl?: typeof classifyFailure;
  /** Override for failure context building (test injection). */
  buildFailureContextImpl?: typeof buildCodexFailureContext;
  /** Override for prompt builder (defaults to GenericPromptBuilder("Claude Code")). @since Phase 6 */
  promptBuilder?: PromptBuilder;
}

/**
 * Claude Code executor adapter.
 *
 * Wraps the Claude Code CLI into the provider-neutral Executor interface.
 * Delegates runTurn to an internally created AgentRunner, following
 * the same pattern as CodexExecutor.
 *
 * Capabilities:
 * - supportsResume: true (via --resume)
 * - supportsStructuredResult: true (same labeled output format)
 * - supportsReasoningControl: true (via --effort)
 */
export class ClaudeCodeExecutor implements Executor {
  readonly capabilities: ExecutorCapabilities;
  private readonly runner: AgentRunner;

  constructor(options: ClaudeCodeExecutorOptions) {
    const baseCaps = (options.probeCapabilitiesImpl ?? detectClaudeCodeCapabilities)(
      options.config,
    );

    this.runner = options.runner ?? createExecutorAgentRunner({
      config: options.config,
      runTurnImpl: options.runTurnImpl ?? runClaudeCodeTurn,
      capabilities: baseCaps,
      classifyFailureImpl: options.classifyFailureImpl,
      buildFailureContextImpl: options.buildFailureContextImpl,
      exitFailureKind: "command_error",
      failureCategory: "codex", // Reuse existing category for backward compat
      providerName: "Claude Code",
      promptBuilder: options.promptBuilder ?? new GenericPromptBuilder("Claude Code"),
    });

    this.capabilities = {
      supportsResume: this.runner.capabilities.supportsResume,
      supportsStructuredResult: this.runner.capabilities.supportsStructuredResult,
      supportsReasoningControl: true, // Claude Code supports --effort
    };
  }

  async runTurn(context: AgentTurnContext): Promise<AgentTurnResult> {
    return this.runner.runTurn(context);
  }
}
