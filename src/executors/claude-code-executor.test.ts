/**
 * Phase 4: Tests for ClaudeCodeExecutor.
 *
 * Verifies:
 * - Capability detection (supportsResume, supportsStructuredResult, supportsReasoningControl)
 * - ClaudeCodeExecutor behavioral parity with the generic executor runner
 * - createExecutor factory resolves ClaudeCodeExecutor for claude binary
 * - Session ID extraction from JSON output
 * - Failure handling for non-zero exit codes
 * - Resume context preserves sessionId
 * - Claude Code JSON output format parsing
 */

import assert from "node:assert/strict";
import test from "node:test";
import type {
  AgentRunner,
  AgentTurnContext,
  AgentTurnResult,
} from "../supervisor/agent-runner";
import type { SupervisorConfig, RunState } from "../core/types";
import {
  ClaudeCodeExecutor,
  detectClaudeCodeCapabilities,
  runClaudeCodeTurn,
} from "./claude-code-executor";
import {
  createExecutor,
  executorToAgentRunner,
  resolveExecutorKind,
} from "./executor";
import {
  extractSessionIdFromJsonOutput,
  extractLastAssistantMessage,
  type ExecutorTurnResult,
  type RunExecutorTurnFn,
} from "./executor-runner";

// ===== Helper functions =====

function createConfig(overrides: Partial<SupervisorConfig> = {}): SupervisorConfig {
  return {
    repoPath: "/tmp/repo",
    repoSlug: "owner/repo",
    defaultBranch: "main",
    workspaceRoot: "/tmp/workspaces",
    stateBackend: "json",
    stateFile: "/tmp/state.json",
    codexBinary: "/usr/bin/claude",
    codexModelStrategy: "inherit",
    codexReasoningEffortByState: {},
    codexReasoningEscalateOnRepeatedFailure: true,
    sharedMemoryFiles: [],
    gsdEnabled: false,
    gsdAutoInstall: false,
    gsdInstallScope: "global",
    gsdPlanningFiles: [],
    localReviewEnabled: false,
    localReviewAutoDetect: true,
    localReviewRoles: [],
    localReviewArtifactDir: "/tmp/reviews",
    localReviewConfidenceThreshold: 0.7,
    localReviewReviewerThresholds: {
      generic: { confidenceThreshold: 0.7, minimumSeverity: "low" },
      specialist: { confidenceThreshold: 0.7, minimumSeverity: "low" },
    },
    localReviewPolicy: "block_ready",
    localReviewHighSeverityAction: "retry",
    reviewBotLogins: [],
    humanReviewBlocksMerge: true,
    issueJournalRelativePath: ".codex-supervisor/issue-journal.md",
    issueJournalMaxChars: 6000,
    skipTitlePrefixes: [],
    branchPrefix: "codex/reopen-issue-",
    pollIntervalSeconds: 60,
    copilotReviewWaitMinutes: 10,
    copilotReviewTimeoutAction: "continue",
    codexExecTimeoutMinutes: 30,
    maxCodexAttemptsPerIssue: 5,
    maxImplementationAttemptsPerIssue: 5,
    maxRepairAttemptsPerIssue: 5,
    timeoutRetryLimit: 2,
    blockedVerificationRetryLimit: 3,
    sameBlockerRepeatLimit: 2,
    sameFailureSignatureRepeatLimit: 3,
    maxDoneWorkspaces: 24,
    cleanupDoneWorkspacesAfterHours: 24,
    mergeMethod: "squash",
    draftPrAfterAttempt: 1,
    ...overrides,
  };
}

function createTurnResult(overrides: Partial<ExecutorTurnResult> = {}): ExecutorTurnResult {
  return {
    exitCode: 0,
    sessionId: "claude-session-001",
    lastMessage: "Summary: test result\nState hint: done",
    stderr: "",
    stdout: "",
    ...overrides,
  };
}

function createStartContext(config: SupervisorConfig): AgentTurnContext {
  return {
    kind: "start",
    config,
    workspacePath: "/tmp/workspace",
    state: "implementing" as RunState,
    record: null,
    repoSlug: config.repoSlug,
    issue: {
      number: 1,
      title: "Test issue",
      body: "",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      url: "https://example.test/issues/1",
    },
    branch: "codex/issue-1",
    pr: null,
    checks: [],
    reviewThreads: [],
    alwaysReadFiles: [],
    onDemandMemoryFiles: [],
    journalPath: "/tmp/journal.md",
    journalExcerpt: null,
    failureContext: null,
    previousSummary: null,
    previousError: null,
  };
}

function createResumeContext(config: SupervisorConfig, sessionId: string): AgentTurnContext {
  return {
    kind: "resume",
    config,
    workspacePath: "/tmp/workspace",
    state: "implementing" as RunState,
    sessionId,
    record: null,
    repoSlug: config.repoSlug,
    issue: {
      number: 1,
      title: "Test issue",
      body: "",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      url: "https://example.test/issues/1",
    },
    branch: "codex/issue-1",
    journalPath: "/tmp/journal.md",
    journalExcerpt: null,
    failureContext: null,
    previousSummary: null,
    previousError: null,
  };
}

// ===== Capability detection tests =====

test("ClaudeCodeExecutor reports supportsResume=true for claude binary", () => {
  const config = createConfig({ codexBinary: "/usr/bin/claude" });
  const executor = new ClaudeCodeExecutor({ config });
  assert.equal(executor.capabilities.supportsResume, true);
  assert.equal(executor.capabilities.supportsStructuredResult, true);
  assert.equal(executor.capabilities.supportsReasoningControl, true);
});

test("ClaudeCodeExecutor reports supportsResume=false for non-claude binary", () => {
  const config = createConfig({ codexBinary: "/usr/bin/custom-agent" });
  const executor = new ClaudeCodeExecutor({
    config,
    probeCapabilitiesImpl: () => detectClaudeCodeCapabilities(config),
  });
  assert.equal(executor.capabilities.supportsResume, false);
  assert.equal(executor.capabilities.supportsStructuredResult, false);
  // supportsReasoningControl is always true for ClaudeCodeExecutor
  assert.equal(executor.capabilities.supportsReasoningControl, true);
});

test("detectClaudeCodeCapabilities returns true for claude binary", () => {
  const caps = detectClaudeCodeCapabilities({ codexBinary: "/usr/local/bin/claude" });
  assert.equal(caps.supportsResume, true);
  assert.equal(caps.supportsStructuredResult, true);
});

test("detectClaudeCodeCapabilities returns true for claude-code binary", () => {
  const caps = detectClaudeCodeCapabilities({ codexBinary: "/usr/bin/claude-code" });
  assert.equal(caps.supportsResume, true);
  assert.equal(caps.supportsStructuredResult, true);
});

test("detectClaudeCodeCapabilities returns false for non-claude binary", () => {
  const caps = detectClaudeCodeCapabilities({ codexBinary: "/usr/bin/codex" });
  assert.equal(caps.supportsResume, false);
  assert.equal(caps.supportsStructuredResult, false);
});

test("detectClaudeCodeCapabilities defaults to claude when no config", () => {
  const caps = detectClaudeCodeCapabilities(null);
  assert.equal(caps.supportsResume, true);
  assert.equal(caps.supportsStructuredResult, true);
});

test("detectClaudeCodeCapabilities honors an explicit executorKind for an aliased binary", () => {
  const caps = detectClaudeCodeCapabilities({ codexBinary: "/usr/local/bin/cc", executorKind: "claude" });
  assert.equal(caps.supportsResume, true);
  assert.equal(caps.supportsStructuredResult, true);
});

test("ClaudeCodeExecutor reports supportsResume=true for an aliased binary with explicit executorKind", () => {
  const config = createConfig({ codexBinary: "/usr/local/bin/cc", executorKind: "claude" });
  const executor = new ClaudeCodeExecutor({ config });
  assert.equal(executor.capabilities.supportsResume, true);
  assert.equal(executor.capabilities.supportsStructuredResult, true);
});

// ===== Behavioral parity tests =====

test("ClaudeCodeExecutor delegates runTurn to underlying runner", async () => {
  const config = createConfig();
  const expected: AgentTurnResult = {
    exitCode: 0,
    sessionId: "session-123",
    supervisorMessage: "Summary: delegated",
    stderr: "",
    stdout: "",
    structuredResult: null,
    failureKind: null,
    failureContext: null,
  };
  const mockRunner: AgentRunner = {
    capabilities: { supportsResume: true, supportsStructuredResult: true },
    async runTurn() { return expected; },
  };
  const executor = new ClaudeCodeExecutor({ config, runner: mockRunner });
  const result = await executor.runTurn(createStartContext(config));
  assert.equal(result.supervisorMessage, "Summary: delegated");
  assert.equal(result, expected);
});

test("ClaudeCodeExecutor with runTurnImpl delegates to mock implementation", async () => {
  const config = createConfig();
  const executor = new ClaudeCodeExecutor({
    config,
    runTurnImpl: async () => createTurnResult({
      sessionId: "mock-session",
      lastMessage: "Summary: mock result\nState hint: done",
    }),
  });
  const result = await executor.runTurn(createStartContext(config));
  assert.equal(result.exitCode, 0);
  assert.equal(result.sessionId, "mock-session");
  assert.equal(result.failureKind, null);
  assert.equal(result.structuredResult?.summary, "mock result");
  assert.equal(result.structuredResult?.stateHint, "done");
});

test("ClaudeCodeExecutor handles non-zero exit with failure classification", async () => {
  const config = createConfig();
  const executor = new ClaudeCodeExecutor({
    config,
    runTurnImpl: async () => createTurnResult({
      exitCode: 1,
      sessionId: "session-fail",
      lastMessage: "Summary: failed",
      stderr: "error output",
    }),
  });
  const result = await executor.runTurn(createStartContext(config));
  assert.equal(result.exitCode, 1);
  assert.equal(result.failureKind, "command_error");
  assert.equal(result.structuredResult, null);
  assert.ok(result.failureContext !== null);
});

test("ClaudeCodeExecutor handles timeout errors with correct failure kind", async () => {
  const config = createConfig();
  const executor = new ClaudeCodeExecutor({
    config,
    runTurnImpl: async () => {
      throw new Error("Command timed out after 1800000ms");
    },
  });
  const result = await executor.runTurn(createStartContext(config));
  assert.equal(result.exitCode, 1);
  assert.equal(result.failureKind, "timeout");
  assert.equal(result.structuredResult, null);
  assert.ok(result.failureContext !== null);
});

test("ClaudeCodeExecutor preserves sessionId for resume context", async () => {
  const config = createConfig();
  const executor = new ClaudeCodeExecutor({
    config,
    runTurnImpl: async (_c, _w, _p, _s, _r, sessionId) => createTurnResult({
      sessionId: sessionId ?? "new-session",
      lastMessage: "Summary: resumed",
    }),
  });
  const result = await executor.runTurn(createResumeContext(config, "resume-session-id"));
  assert.equal(result.sessionId, "resume-session-id");
});

// ===== Factory tests =====

test("createExecutor returns ClaudeCodeExecutor for claude binary", () => {
  const config = createConfig({ codexBinary: "/usr/bin/claude" });
  const executor = createExecutor(config);
  assert.ok(executor instanceof ClaudeCodeExecutor);
  assert.equal(executor.capabilities.supportsReasoningControl, true);
});

test("createExecutor returns ClaudeCodeExecutor for claude-code binary", () => {
  const config = createConfig({ codexBinary: "/usr/bin/claude-code" });
  const executor = createExecutor(config);
  assert.ok(executor instanceof ClaudeCodeExecutor);
});

test("createExecutor wraps provided runner for claude config", () => {
  const config = createConfig({ codexBinary: "/usr/bin/claude" });
  const mockRunner: AgentRunner = {
    capabilities: { supportsResume: false, supportsStructuredResult: false },
    async runTurn() {
      return {
        exitCode: 0,
        sessionId: "mock",
        supervisorMessage: "",
        stderr: "",
        stdout: "",
        structuredResult: null,
        failureKind: null,
        failureContext: null,
      };
    },
  };
  const executor = createExecutor(config, { runner: mockRunner });
  assert.equal(executor.capabilities.supportsResume, false);
  assert.equal(executor.capabilities.supportsStructuredResult, false);
  assert.equal(executor.capabilities.supportsReasoningControl, false);
});

test("resolveExecutorKind detects claude", () => {
  const config = createConfig({ codexBinary: "/usr/bin/claude" });
  assert.equal(resolveExecutorKind(config), "claude");
});

test("resolveExecutorKind detects claude-code", () => {
  const config = createConfig({ codexBinary: "/usr/bin/claude-code" });
  assert.equal(resolveExecutorKind(config), "claude");
});

test("ClaudeCodeExecutor via executorToAgentRunner produces valid AgentRunner", async () => {
  const config = createConfig();
  const executor = new ClaudeCodeExecutor({
    config,
    runTurnImpl: async () => createTurnResult({
      sessionId: "test-session",
      lastMessage: "Summary: adapter test",
    }),
  });
  const runner = executorToAgentRunner(executor);
  assert.equal(runner.capabilities.supportsResume, executor.capabilities.supportsResume);
  assert.equal(runner.capabilities.supportsStructuredResult, executor.capabilities.supportsStructuredResult);
  const result = await runner.runTurn(createStartContext(config));
  assert.equal(result.sessionId, "test-session");
});

// ===== Claude Code JSON output format tests =====

test("extractLastAssistantMessage parses Claude Code result event", () => {
  // Claude Code --output-format json produces a result object
  const stdout = JSON.stringify({
    type: "result",
    result: "Summary: implementation done\nState hint: done",
    session_id: "claude-sess-001",
  });
  assert.equal(
    extractLastAssistantMessage(stdout),
    "Summary: implementation done\nState hint: done",
  );
});

test("extractLastAssistantMessage parses Claude Code assistant message with content array", () => {
  // Claude Code stream-json format
  const stdout = [
    '{"type":"assistant","message":{"content":[{"type":"text","text":"Summary: streamed result"}]}}',
  ].join("\n");
  assert.equal(extractLastAssistantMessage(stdout), "Summary: streamed result");
});

test("extractSessionIdFromJsonOutput extracts session_id from Claude Code result", () => {
  const stdout = JSON.stringify({
    type: "result",
    result: "done",
    session_id: "claude-uuid-12345",
  });
  assert.equal(extractSessionIdFromJsonOutput(stdout), "claude-uuid-12345");
});

// ===== Structured result parsing tests =====

test("ClaudeCodeExecutor parses structured result from labeled output", async () => {
  const config = createConfig();
  const executor = new ClaudeCodeExecutor({
    config,
    runTurnImpl: async () => createTurnResult({
      lastMessage: [
        "Summary: implementation complete",
        "State hint: implementing",
        "Tests: not run",
        "Next action: continue",
      ].join("\n"),
    }),
  });
  const result = await executor.runTurn(createStartContext(config));
  assert.equal(result.structuredResult?.summary, "implementation complete");
  assert.equal(result.structuredResult?.stateHint, "implementing");
  assert.equal(result.structuredResult?.tests, "not run");
  assert.equal(result.structuredResult?.nextAction, "continue");
});

test("ClaudeCodeExecutor parses failed state with failure signature", async () => {
  const config = createConfig();
  const executor = new ClaudeCodeExecutor({
    config,
    runTurnImpl: async () => createTurnResult({
      lastMessage: [
        "Summary: implementation failed",
        "State hint: failed",
        "Failure signature: compile-error",
      ].join("\n"),
    }),
  });
  const result = await executor.runTurn(createStartContext(config));
  assert.equal(result.structuredResult?.stateHint, "failed");
  assert.equal(result.structuredResult?.failureSignature, "compile-error");
  assert.equal(result.structuredResult?.blockedReason, null);
});

test("ClaudeCodeExecutor returns null structuredResult for unstructured output", async () => {
  const config = createConfig();
  const executor = new ClaudeCodeExecutor({
    config,
    runTurnImpl: async () => createTurnResult({
      lastMessage: "just some random text without labels",
    }),
  });
  const result = await executor.runTurn(createStartContext(config));
  assert.equal(result.structuredResult, null);
});

// ===== Cross-executor consistency tests =====

test("ClaudeCodeExecutor and OpenCodeExecutor produce same result shape", async () => {
  const claudeConfig = createConfig({ codexBinary: "/usr/bin/claude" });
  const opencodeConfig = createConfig({ codexBinary: "/usr/bin/opencode" });

  const claudeExecutor = new ClaudeCodeExecutor({
    config: claudeConfig,
    runTurnImpl: async () => createTurnResult({
      lastMessage: "Summary: same output\nState hint: done",
    }),
  });
  const opencodeExecutor = new (await import("./opencode-executor")).OpenCodeExecutor({
    config: opencodeConfig,
    runTurnImpl: async () => createTurnResult({
      lastMessage: "Summary: same output\nState hint: done",
    }),
  });

  const claudeResult = await claudeExecutor.runTurn(createStartContext(claudeConfig));
  const opencodeResult = await opencodeExecutor.runTurn(createStartContext(opencodeConfig));

  assert.equal(claudeResult.exitCode, opencodeResult.exitCode);
  assert.equal(claudeResult.structuredResult?.summary, opencodeResult.structuredResult?.summary);
  assert.equal(claudeResult.structuredResult?.stateHint, opencodeResult.structuredResult?.stateHint);
  assert.equal(claudeResult.failureKind, opencodeResult.failureKind);
});

// ===== Phase 4 Fix: override impls through createExecutor =====

test("createExecutor passes classifyFailureImpl to ClaudeCodeExecutor", () => {
  const config = createConfig({ codexBinary: "/usr/bin/claude" });
  const classifyFailureImpl = (_msg: string | null | undefined) => "command_error" as const;

  const executor = createExecutor(config, { classifyFailureImpl });
  assert.ok(executor instanceof (require("./claude-code-executor").ClaudeCodeExecutor));
  assert.ok(executor.capabilities.supportsResume);
});

test("createExecutor passes buildFailureContextImpl to ClaudeCodeExecutor", () => {
  const config = createConfig({ codexBinary: "/usr/bin/claude" });
  const buildFailureContextImpl = (
    _category: any,
    summary: string,
    _details: string[],
  ) => ({
    category: "codex" as const,
    summary,
    signature: null,
    command: null,
    details: [],
    url: null,
    updated_at: new Date().toISOString(),
  });

  const executor = createExecutor(config, { buildFailureContextImpl });
  assert.ok(executor instanceof (require("./claude-code-executor").ClaudeCodeExecutor));
  assert.ok(executor.capabilities.supportsResume);
});

test("ClaudeCodeExecutor applies reasoning effort when state is provided", async () => {
  const config = createConfig({
    codexBinary: "/usr/bin/claude",
    codexReasoningEffortByState: { implementing: "high" },
  });

  const runTurnImpl: RunExecutorTurnFn = async (
    _config,
    _workspacePath,
    _prompt,
    state,
    _record,
    _sessionId,
  ) => {
    assert.equal(state, "implementing");
    return {
      exitCode: 0,
      sessionId: "claude-session-001",
      lastMessage: "State hint: done\nSummary: effort applied",
      stderr: "",
      stdout: "",
    };
  };

  const executor = new ClaudeCodeExecutor({ config, runTurnImpl });
  const result = await executor.runTurn(createStartContext(config));

  assert.equal(result.exitCode, 0);
  assert.equal(result.structuredResult?.stateHint, "done");
});
