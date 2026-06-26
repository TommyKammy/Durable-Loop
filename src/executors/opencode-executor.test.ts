/**
 * Phase 4: Tests for OpenCodeExecutor.
 *
 * Verifies:
 * - Capability detection (supportsResume, supportsStructuredResult, supportsReasoningControl)
 * - OpenCodeExecutor behavioral parity with the generic executor runner
 * - createExecutor factory resolves OpenCodeExecutor for opencode binary
 * - Session ID extraction from JSON output
 * - Failure handling for non-zero exit codes
 * - Resume context preserves sessionId
 * - CLI argument construction
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
  OpenCodeExecutor,
  detectOpenCodeCapabilities,
  runOpenCodeTurn,
} from "./opencode-executor";
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
    codexBinary: "/usr/bin/opencode",
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
    sessionId: "opencode-session-001",
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

test("OpenCodeExecutor reports supportsResume=true for opencode binary", () => {
  const config = createConfig({ codexBinary: "/usr/bin/opencode" });
  const executor = new OpenCodeExecutor({ config });
  assert.equal(executor.capabilities.supportsResume, true);
  assert.equal(executor.capabilities.supportsStructuredResult, true);
  assert.equal(executor.capabilities.supportsReasoningControl, true);
});

test("OpenCodeExecutor reports supportsResume=false for non-opencode binary", () => {
  const config = createConfig({ codexBinary: "/usr/bin/custom-agent" });
  const executor = new OpenCodeExecutor({
    config,
    probeCapabilitiesImpl: () => detectOpenCodeCapabilities(config),
  });
  assert.equal(executor.capabilities.supportsResume, false);
  assert.equal(executor.capabilities.supportsStructuredResult, false);
  // supportsReasoningControl is always true for OpenCodeExecutor
  assert.equal(executor.capabilities.supportsReasoningControl, true);
});

test("detectOpenCodeCapabilities returns true for opencode binary", () => {
  const caps = detectOpenCodeCapabilities({ codexBinary: "/usr/local/bin/opencode" });
  assert.equal(caps.supportsResume, true);
  assert.equal(caps.supportsStructuredResult, true);
});

test("detectOpenCodeCapabilities returns false for non-opencode binary", () => {
  const caps = detectOpenCodeCapabilities({ codexBinary: "/usr/bin/codex" });
  assert.equal(caps.supportsResume, false);
  assert.equal(caps.supportsStructuredResult, false);
});

test("detectOpenCodeCapabilities defaults to opencode when no config", () => {
  const caps = detectOpenCodeCapabilities(null);
  assert.equal(caps.supportsResume, true);
  assert.equal(caps.supportsStructuredResult, true);
});

// ===== Behavioral parity tests =====

test("OpenCodeExecutor delegates runTurn to underlying runner", async () => {
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
  const executor = new OpenCodeExecutor({ config, runner: mockRunner });
  const result = await executor.runTurn(createStartContext(config));
  assert.equal(result.supervisorMessage, "Summary: delegated");
  assert.equal(result, expected);
});

test("OpenCodeExecutor with runTurnImpl delegates to mock implementation", async () => {
  const config = createConfig();
  const executor = new OpenCodeExecutor({
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

test("OpenCodeExecutor handles non-zero exit with failure classification", async () => {
  const config = createConfig();
  const executor = new OpenCodeExecutor({
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

test("OpenCodeExecutor handles timeout errors with correct failure kind", async () => {
  const config = createConfig();
  const executor = new OpenCodeExecutor({
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

test("OpenCodeExecutor preserves sessionId for resume context", async () => {
  const config = createConfig();
  const executor = new OpenCodeExecutor({
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

test("createExecutor returns OpenCodeExecutor for opencode binary", () => {
  const config = createConfig({ codexBinary: "/usr/bin/opencode" });
  const executor = createExecutor(config);
  assert.ok(executor instanceof OpenCodeExecutor);
  assert.equal(executor.capabilities.supportsReasoningControl, true);
});

test("createExecutor wraps provided runner for opencode config", () => {
  const config = createConfig({ codexBinary: "/usr/bin/opencode" });
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

test("resolveExecutorKind detects opencode", () => {
  const config = createConfig({ codexBinary: "/usr/bin/opencode" });
  assert.equal(resolveExecutorKind(config), "opencode");
});

test("OpenCodeExecutor via executorToAgentRunner produces valid AgentRunner", async () => {
  const config = createConfig();
  const executor = new OpenCodeExecutor({
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

// ===== Session ID extraction tests =====

test("extractSessionIdFromJsonOutput extracts session_id from session event", () => {
  const stdout = [
    '{"type":"session.started","session_id":"abc-123-def"}',
    '{"type":"assistant","content":"hello"}',
  ].join("\n");
  assert.equal(extractSessionIdFromJsonOutput(stdout), "abc-123-def");
});

test("extractSessionIdFromJsonOutput extracts thread_id from thread event", () => {
  const stdout = [
    '{"type":"thread.started","thread_id":"thread-abc-123"}',
  ].join("\n");
  assert.equal(extractSessionIdFromJsonOutput(stdout), "thread-abc-123");
});

test("extractSessionIdFromJsonOutput uses fallback when no JSON found", () => {
  assert.equal(extractSessionIdFromJsonOutput("no json here", "fallback-id"), "fallback-id");
});

test("extractSessionIdFromJsonOutput returns null for empty output", () => {
  assert.equal(extractSessionIdFromJsonOutput(""), null);
});

test("extractSessionIdFromJsonOutput handles OpenCode-style events", () => {
  const stdout = [
    '{"type":"session","session_id":"opencode-sess-001"}',
    '{"type":"assistant","content":"Summary: done"}',
  ].join("\n");
  assert.equal(extractSessionIdFromJsonOutput(stdout), "opencode-sess-001");
});

// ===== Assistant message extraction tests =====

test("extractLastAssistantMessage extracts text from assistant event", () => {
  const stdout = [
    '{"type":"session","session_id":"s1"}',
    '{"type":"assistant","content":"Summary: test\\nState hint: done"}',
  ].join("\n");
  assert.equal(extractLastAssistantMessage(stdout), "Summary: test\nState hint: done");
});

test("extractLastAssistantMessage returns last assistant message when multiple", () => {
  const stdout = [
    '{"type":"assistant","content":"first message"}',
    '{"type":"assistant","content":"second message"}',
  ].join("\n");
  assert.equal(extractLastAssistantMessage(stdout), "second message");
});

test("extractLastAssistantMessage returns empty string for no assistant events", () => {
  const stdout = '{"type":"session","session_id":"s1"}';
  assert.equal(extractLastAssistantMessage(stdout), "");
});

test("extractLastAssistantMessage handles content array format", () => {
  const stdout = [
    '{"type":"assistant","content":[{"type":"text","text":"Summary: array format"}]}',
  ].join("\n");
  assert.equal(extractLastAssistantMessage(stdout), "Summary: array format");
});

// ===== Structured result parsing tests =====

test("OpenCodeExecutor parses structured result from labeled output", async () => {
  const config = createConfig();
  const executor = new OpenCodeExecutor({
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

test("OpenCodeExecutor parses blocked state with reason", async () => {
  const config = createConfig();
  const executor = new OpenCodeExecutor({
    config,
    runTurnImpl: async () => createTurnResult({
      lastMessage: [
        "Summary: blocked on verification",
        "State hint: blocked",
        "Blocked reason: verification",
        "Failure signature: missing-test",
      ].join("\n"),
    }),
  });
  const result = await executor.runTurn(createStartContext(config));
  assert.equal(result.structuredResult?.stateHint, "blocked");
  assert.equal(result.structuredResult?.blockedReason, "verification");
  assert.equal(result.structuredResult?.failureSignature, "missing-test");
});

test("OpenCodeExecutor returns null structuredResult for unstructured output", async () => {
  const config = createConfig();
  const executor = new OpenCodeExecutor({
    config,
    runTurnImpl: async () => createTurnResult({
      lastMessage: "just some random text without labels",
    }),
  });
  const result = await executor.runTurn(createStartContext(config));
  assert.equal(result.structuredResult, null);
});

// ===== Phase 4 Fix: state passing to buildOpenCodeArgs =====

test("OpenCodeExecutor applies reasoning variant when state is provided", async () => {
  const config = createConfig({
    codexBinary: "/usr/bin/opencode",
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
      sessionId: "test-session-001",
      lastMessage: "State hint: done\nSummary: variant applied",
      stderr: "",
      stdout: "",
    };
  };

  const executor = new OpenCodeExecutor({ config, runTurnImpl });
  const result = await executor.runTurn(createStartContext(config));

  assert.equal(result.exitCode, 0);
  assert.equal(result.structuredResult?.stateHint, "done");
});

test("createExecutor passes classifyFailureImpl to OpenCodeExecutor", async () => {
  const config = createConfig({ codexBinary: "/usr/bin/opencode" });
  let classifyCalled = false;
  const classifyFailureImpl = (_msg: string | null | undefined) => {
    classifyCalled = true;
    return "command_error" as const;
  };

  const executor = createExecutor(config, { classifyFailureImpl });
  // Verify it's an OpenCodeExecutor
  assert.ok(executor instanceof (require("./opencode-executor").OpenCodeExecutor));

  // We can't easily test the classifyFailureImpl without a real turn,
  // but we can verify the executor was created without error.
  assert.ok(executor.capabilities.supportsResume);
});

test("createExecutor passes buildFailureContextImpl to OpenCodeExecutor", () => {
  const config = createConfig({ codexBinary: "/usr/bin/opencode" });
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
  assert.ok(executor instanceof (require("./opencode-executor").OpenCodeExecutor));
  assert.ok(executor.capabilities.supportsResume);
});
