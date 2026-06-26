/**
 * Phase 0-4: Executors barrel export.
 */

export type {
  Executor,
  ExecutorCapabilities,
  ExecutorKind,
  PromptBuilder,
} from "./types";

export {
  resolveExecutorKind,
  agentRunnerToExecutor,
  executorToAgentRunner,
  createExecutor,
  type CreateExecutorOptions,
} from "./executor";

export { MockExecutor } from "./mock-executor";
export type { MockExecutorOptions } from "./mock-executor";

export { CodexExecutor, CodexModelPolicy, CodexOutputParser } from "./codex-executor";
export type { CodexExecutorOptions } from "./codex-executor";

export { OpenCodeExecutor, detectOpenCodeCapabilities, runOpenCodeTurn } from "./opencode-executor";
export type { OpenCodeExecutorOptions } from "./opencode-executor";

export { ClaudeCodeExecutor, detectClaudeCodeCapabilities, runClaudeCodeTurn } from "./claude-code-executor";
export type { ClaudeCodeExecutorOptions } from "./claude-code-executor";

export {
  createExecutorAgentRunner,
  runExecutorCliCommand,
  extractSessionIdFromJsonOutput,
  extractLastAssistantMessage,
  type ExecutorTurnResult,
  type RunExecutorTurnFn,
} from "./executor-runner";

export {
  CodexPromptBuilder,
  GenericPromptBuilder,
  createPromptBuilder,
} from "./prompt-builder";
