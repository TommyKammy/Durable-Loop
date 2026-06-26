/**
 * Phase 0: Executor abstraction — provider-neutral supertype of AgentRunner.
 *
 * The Executor interface is a structural supertype of the existing AgentRunner
 * interface. Any value that satisfies AgentRunner also satisfies Executor,
 * enabling gradual migration from Codex-specific to executor-agnostic code.
 */

import type {
  AgentRunnerCapabilities,
  AgentTurnContext,
  AgentTurnResult,
} from "../supervisor/agent-runner";

/**
 * Extended capabilities with an optional reasoning-control flag.
 * AgentRunnerCapabilities is structurally compatible because the extra
 * field is optional.
 */
export interface ExecutorCapabilities extends AgentRunnerCapabilities {
  /** Whether the executor supports reasoning effort control. */
  supportsReasoningControl?: boolean;
}

/**
 * Provider-neutral executor interface.
 *
 * Structurally compatible with AgentRunner: any AgentRunner value can be
 * used as an Executor without modification.
 */
export interface Executor {
  readonly capabilities: ExecutorCapabilities;
  runTurn(context: AgentTurnContext): Promise<AgentTurnResult>;
}


/**
 * Provider-neutral prompt builder interface.
 *
 * Abstracts the construction of the supervisor prompt from Codex-specific
 * implementation. The prompt format (labeled footer with Summary, State hint,
 * Blocked reason, etc.) is identical across all builders — only the
 * provider-specific language in the prompt body differs.
 *
 * Phase 5: Introduced to decouple executor-runner.ts from buildCodexPrompt.
 */
export interface PromptBuilder {
  /**
   * Build the supervisor prompt for a given turn context.
   *
   * The returned string must contain the labeled footer format:
   *   Summary: <short summary>
   *   State hint: <state>
   *   Blocked reason: <reason|none>
   *   Tests: <what you ran or not run>
   *   Failure signature: <signature or none>
   *   Next action: <next action>
   *
   * This footer is parsed by parseAgentTurnStructuredResult and must
   * not vary between providers.
   */
  buildPrompt(context: AgentTurnContext): string;
}

/**
 * Identifier for the executor implementation.
 */
export type ExecutorKind = "codex" | "opencode" | "claude" | "mock";
