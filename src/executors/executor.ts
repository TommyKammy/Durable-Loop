/**
 * Phase 0-4: Executor factory and adapter utilities.
 */

import type { SupervisorConfig } from "../core/types";
import type { AgentRunner } from "../agent-contract";
import type { Executor, ExecutorCapabilities, ExecutorKind } from "./types";
import { CodexExecutor } from "./codex-executor";
import { MockExecutor } from "./mock-executor";
import { OpenCodeExecutor } from "./opencode-executor";
import { ClaudeCodeExecutor } from "./claude-code-executor";
import type { classifyFailure, buildCodexFailureContext } from "../supervisor/supervisor-failure-helpers";
import type { PromptBuilder } from "./types";

/**
 * Returns the executor kind from the supervisor config.
 *
 * An explicit `executorKind` config field takes precedence; otherwise the kind
 * is inferred from the `executorBinary` path (an aliased binary name that does not
 * contain "opencode"/"claude" falls back to "codex"). The explicit field exists
 * because path inference is ambiguous for aliased binaries.
 */
export function resolveExecutorKind(
  config: Pick<SupervisorConfig, "executorBinary" | "executorKind">,
): ExecutorKind {
  if (config.executorKind) {
    return config.executorKind;
  }
  const binary = config.executorBinary?.toLowerCase() ?? "";
  if (binary.includes("opencode")) return "opencode";
  if (binary.includes("claude")) return "claude";
  return "codex";
}

/**
 * Wraps an existing AgentRunner into an Executor.
 */
export function agentRunnerToExecutor(runner: AgentRunner): Executor {
  const capabilities: ExecutorCapabilities = {
    supportsResume: runner.capabilities.supportsResume,
    supportsStructuredResult: runner.capabilities.supportsStructuredResult,
    supportsReasoningControl: false,
  };
  return {
    capabilities,
    runTurn: (context) => runner.runTurn(context),
  };
}

/**
 * Inverse adapter: wraps an Executor back into an AgentRunner.
 */
export function executorToAgentRunner(executor: Executor): AgentRunner {
  return {
    capabilities: {
      supportsResume: executor.capabilities.supportsResume,
      supportsStructuredResult: executor.capabilities.supportsStructuredResult,
    },
    runTurn: (context) => executor.runTurn(context),
  };
}

/**
 * Options for creating an executor via the factory.
 *
 * Supports test injection of a pre-existing runner, or provider-specific
 * override implementations for failure classification and context building.
 */
export interface CreateExecutorOptions {
  /** Optional pre-existing runner to wrap (skips executor creation). */
  runner?: AgentRunner;
  /** Override for failure classification (test injection). */
  classifyFailureImpl?: typeof classifyFailure;
  /** Override for failure context building (test injection). */
  buildFailureContextImpl?: typeof buildCodexFailureContext;
  /** Override for prompt builder (test injection). @since Phase 6 */
  promptBuilder?: PromptBuilder;
}

/**
 * Factory that creates the appropriate Executor for the configured provider.
 *
 * When a pre-existing runner is provided (e.g. from test injection), wraps
 * it with agentRunnerToExecutor. Otherwise, resolves the executor kind from
 * the config and creates the appropriate executor:
 * - "codex" → CodexExecutor (Phase 1)
 * - "mock"  → MockExecutor (Phase 0)
 * - "opencode" → OpenCodeExecutor (Phase 4)
 * - "claude" → ClaudeCodeExecutor (Phase 4)
 *
 * Override implementations (classifyFailureImpl, buildFailureContextImpl)
 * are passed through to the executor for test injection. Not all executors
 * support all overrides — only CodexExecutor, OpenCodeExecutor, and
 * ClaudeCodeExecutor accept them.
 *
 * @param config - Supervisor configuration
 * @param options - Optional runner or override implementations
 * @returns The appropriate Executor for the configured provider
 */
export function createExecutor(
  config: SupervisorConfig,
  options?: CreateExecutorOptions,
): Executor {
  if (options?.runner) {
    return agentRunnerToExecutor(options.runner);
  }

  const kind = resolveExecutorKind(config);
  const overrides = options
    ? {
        classifyFailureImpl: options.classifyFailureImpl,
        buildFailureContextImpl: options.buildFailureContextImpl,
        promptBuilder: options.promptBuilder,
      }
    : {};

  switch (kind) {
    case "codex":
      return new CodexExecutor({ config, ...overrides });
    case "mock":
      return new MockExecutor();
    case "opencode":
      return new OpenCodeExecutor({ config, ...overrides });
    case "claude":
      return new ClaudeCodeExecutor({ config, ...overrides });
    default: {
      const _exhaustive: never = kind;
      throw new Error(`createExecutor: unknown executor kind "${String(_exhaustive)}"`);
    }
  }
}
