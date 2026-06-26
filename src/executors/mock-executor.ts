/**
 * Phase 0: Mock executor for contract tests and development.
 */

import type { AgentTurnContext, AgentTurnResult } from "../supervisor/agent-runner";
import type { Executor, ExecutorCapabilities } from "./types";

export interface MockExecutorOptions {
  capabilities?: Partial<ExecutorCapabilities>;
  result?: Partial<AgentTurnResult>;
}

export class MockExecutor implements Executor {
  readonly capabilities: ExecutorCapabilities;
  private readonly mockResult: AgentTurnResult;

  constructor(options: MockExecutorOptions = {}) {
    this.capabilities = {
      supportsResume: options.capabilities?.supportsResume ?? true,
      supportsStructuredResult: options.capabilities?.supportsStructuredResult ?? true,
      supportsReasoningControl: options.capabilities?.supportsReasoningControl ?? false,
    };
    this.mockResult = {
      exitCode: options.result?.exitCode ?? 0,
      sessionId: options.result?.sessionId ?? "mock-session-001",
      supervisorMessage: options.result?.supervisorMessage ?? "Mock turn completed.",
      stderr: options.result?.stderr ?? "",
      stdout: options.result?.stdout ?? "",
      structuredResult: options.result?.structuredResult ?? null,
      failureKind: options.result?.failureKind ?? null,
      failureContext: options.result?.failureContext ?? null,
    };
  }

  async runTurn(_context: AgentTurnContext): Promise<AgentTurnResult> {
    return this.mockResult;
  }
}
