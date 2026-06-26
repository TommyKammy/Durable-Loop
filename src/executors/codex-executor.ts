/**
 * Phase 1: CodexExecutor — adapter wrapping createCodexAgentRunner
 * into the provider-neutral Executor interface.
 *
 * Separates three Codex-specific concerns:
 * 1. Capability detection — maps Codex CLI capabilities to ExecutorCapabilities
 * 2. Model policy — resolves model + reasoning effort for a given state
 * 3. Output parser — parses Codex output into structured results
 *
 * The executor delegates runTurn to the underlying AgentRunner,
 * maintaining zero behavioral change with the existing createCodexAgentRunner.
 */

import {
  createCodexAgentRunner,
  detectCodexCliCapabilities,
  parseAgentTurnStructuredResult,
  type CreateCodexAgentRunnerOptions,
} from "../supervisor/agent-runner";
import type {
  AgentRunner,
  AgentTurnContext,
  AgentTurnResult,
  AgentTurnStructuredResult,
} from "../supervisor/agent-runner";
import { resolveCodexExecutionPolicy } from "../codex/codex-policy";
import type { CodexExecutionPolicy } from "../codex/codex-policy";
import type { Executor, ExecutorCapabilities } from "./types";
import type {
  SupervisorConfig,
  RunState,
  IssueRunRecord,
  CodexExecutionTarget,
} from "../core/types";

/**
 * Config subset needed for model policy resolution.
 */
type ModelPolicyConfig = Pick<
  SupervisorConfig,
  | "codexModelStrategy"
  | "codexModel"
  | "boundedRepairModelStrategy"
  | "boundedRepairModel"
  | "localReviewModelStrategy"
  | "localReviewModel"
  | "codexReasoningEffortByState"
  | "codexReasoningEscalateOnRepeatedFailure"
>;

/**
 * Record subset needed for model policy resolution.
 */
type ModelPolicyRecord = Pick<
  IssueRunRecord,
  | "repeated_failure_signature_count"
  | "blocked_verification_retry_count"
  | "timeout_retry_count"
  | "last_tracked_pr_progress_snapshot"
  | "codex_connector_stable_churn_dossier_consumed_signature"
>;

/**
 * Codex model policy resolver.
 *
 * Wraps resolveCodexExecutionPolicy to provide model + reasoning effort
 * resolution for a given state and record. This is the Phase 1 separation
 * of the model selection concern from the runner.
 */
export class CodexModelPolicy {
  constructor(private readonly config: ModelPolicyConfig) {}

  /**
   * Resolve the execution policy (model + reasoning effort) for a given
   * state, record, and target.
   */
  resolve(
    state: RunState,
    record?: ModelPolicyRecord | null,
    target: CodexExecutionTarget = "supervisor",
  ): CodexExecutionPolicy {
    return resolveCodexExecutionPolicy(this.config, state, record, target);
  }
}

/**
 * Codex output parser.
 *
 * Wraps parseAgentTurnStructuredResult to parse Codex output
 * into structured results. This is the Phase 1 separation of the
 * output parsing concern from the runner.
 */
export class CodexOutputParser {
  /**
   * Parse a supervisor message into a structured result.
   * Returns null when the message contains no structured fields.
   */
  parse(message: string): AgentTurnStructuredResult | null {
    return parseAgentTurnStructuredResult(message);
  }
}

/**
 * Options for constructing a CodexExecutor.
 *
 * Extends CreateCodexAgentRunnerOptions to allow test injection of
 * mock implementations. In production, only `config` is required.
 */
export interface CodexExecutorOptions {
  config: SupervisorConfig;
  /** Optional pre-existing runner to wrap (skips internal createCodexAgentRunner). */
  runner?: AgentRunner;
  /** Override for the Codex turn implementation (test injection). */
  runCodexTurnImpl?: CreateCodexAgentRunnerOptions["runCodexTurnImpl"];
  /** Override for failure classification (test injection). */
  classifyFailureImpl?: CreateCodexAgentRunnerOptions["classifyFailureImpl"];
  /** Override for failure context building (test injection). */
  buildFailureContextImpl?: CreateCodexAgentRunnerOptions["buildFailureContextImpl"];
  /** Override for capability probing (test injection). */
  probeCapabilitiesImpl?: CreateCodexAgentRunnerOptions["probeCapabilitiesImpl"];
  /** Override for prompt builder (test injection). @since Phase 6 */
  promptBuilder?: CreateCodexAgentRunnerOptions["promptBuilder"];
}

/**
 * Codex executor adapter.
 *
 * Wraps createCodexAgentRunner into the provider-neutral Executor
 * interface, adding supportsReasoningControl capability. Delegates
 * runTurn to the underlying AgentRunner with zero behavioral change.
 *
 * Exposes modelPolicy and outputParser as accessible properties
 * for diagnostics and Phase 4 extensibility.
 */
export class CodexExecutor implements Executor {
  readonly capabilities: ExecutorCapabilities;
  readonly modelPolicy: CodexModelPolicy;
  readonly outputParser: CodexOutputParser;
  private readonly runner: AgentRunner;

  constructor(options: CodexExecutorOptions) {
    this.runner = options.runner ?? createCodexAgentRunner({
      config: options.config,
      runCodexTurnImpl: options.runCodexTurnImpl,
      classifyFailureImpl: options.classifyFailureImpl,
      buildFailureContextImpl: options.buildFailureContextImpl,
      probeCapabilitiesImpl: options.probeCapabilitiesImpl,
      promptBuilder: options.promptBuilder,
    });

    const baseCaps = this.runner.capabilities;
    this.capabilities = {
      supportsResume: baseCaps.supportsResume,
      supportsStructuredResult: baseCaps.supportsStructuredResult,
      // Codex supports reasoning effort control via model_reasoning_effort
      supportsReasoningControl: true,
    };

    this.modelPolicy = new CodexModelPolicy(options.config);
    this.outputParser = new CodexOutputParser();
  }

  async runTurn(context: AgentTurnContext): Promise<AgentTurnResult> {
    return this.runner.runTurn(context);
  }
}
