/**
 * Phase 1: Tests for CodexExecutor, CodexModelPolicy, and CodexOutputParser.
 *
 * Verifies:
 * - Capability detection (supportsResume, supportsStructuredResult, supportsReasoningControl)
 * - CodexModelPolicy (model resolution for different states)
 * - CodexOutputParser (parsing structured results from messages)
 * - CodexExecutor behavioral parity with createCodexAgentRunner
 * - createExecutor factory resolves correct executor kind
 */

import assert from "node:assert/strict";
import test from "node:test";
import type {
  AgentRunner,
  AgentTurnContext,
  AgentTurnResult,
  AgentTurnStructuredResult,
} from "../supervisor/agent-runner";
import {
  createCodexAgentRunner,
  detectCodexCliCapabilities,
  parseAgentTurnStructuredResult,
} from "../supervisor/agent-runner";
import type {
  SupervisorConfig,
  RunState,
} from "../core/types";
import { CodexExecutor, CodexModelPolicy, CodexOutputParser } from "./codex-executor";
import { createExecutor, executorToAgentRunner, resolveExecutorKind } from "./executor";
import { MockExecutor } from "./mock-executor";

function createConfig(overrides: Partial<SupervisorConfig> = {}): SupervisorConfig {
  return {
    repoPath: "/tmp/repo",
    repoSlug: "owner/repo",
    defaultBranch: "main",
    workspaceRoot: "/tmp/workspaces",
    stateBackend: "json",
    stateFile: "/tmp/state.json",
    codexBinary: "/usr/bin/codex",
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

function createTurnResult(overrides: Partial<AgentTurnResult> = {}): AgentTurnResult {
  return {
    exitCode: 0,
    sessionId: "session-123",
    supervisorMessage: "Summary: test result",
    stderr: "",
    stdout: "",
    structuredResult: null,
    failureKind: null,
    failureContext: null,
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

// ===== Capability detection tests =====

test("CodexExecutor reports supportsReasoningControl=true for codex binary", () => {
  const config = createConfig({ codexBinary: "/usr/bin/codex" });
  const executor = new CodexExecutor({
    config,
    probeCapabilitiesImpl: () => detectCodexCliCapabilities(config),
  });
  assert.equal(executor.capabilities.supportsResume, true);
  assert.equal(executor.capabilities.supportsStructuredResult, true);
  assert.equal(executor.capabilities.supportsReasoningControl, true);
});

test("CodexExecutor reports supportsResume=false for non-codex binary", () => {
  const config = createConfig({ codexBinary: "/usr/bin/custom-agent" });
  const executor = new CodexExecutor({
    config,
    probeCapabilitiesImpl: () => detectCodexCliCapabilities(config),
  });
  assert.equal(executor.capabilities.supportsResume, false);
  assert.equal(executor.capabilities.supportsStructuredResult, false);
  assert.equal(executor.capabilities.supportsReasoningControl, true);
});

test("CodexExecutor preserves base capabilities from detectCodexCliCapabilities", () => {
  const config = createConfig();
  const baseCaps = detectCodexCliCapabilities(config);
  const executor = new CodexExecutor({
    config,
    probeCapabilitiesImpl: () => baseCaps,
  });
  assert.equal(executor.capabilities.supportsResume, baseCaps.supportsResume);
  assert.equal(executor.capabilities.supportsStructuredResult, baseCaps.supportsStructuredResult);
});

test("CodexExecutor adds supportsReasoningControl on top of base capabilities", () => {
  const config = createConfig({ codexBinary: "/usr/bin/custom-agent" });
  const executor = new CodexExecutor({
    config,
    probeCapabilitiesImpl: () => ({ supportsResume: false, supportsStructuredResult: false }),
  });
  assert.equal(executor.capabilities.supportsResume, false);
  assert.equal(executor.capabilities.supportsStructuredResult, false);
  assert.equal(executor.capabilities.supportsReasoningControl, true);
});

// ===== CodexModelPolicy tests =====

test("CodexModelPolicy resolves policy for implementing state with default target", () => {
  const config = createConfig({
    codexModelStrategy: "fixed",
    codexModel: "gpt-4-test",
    codexReasoningEffortByState: { implementing: "high" },
  });
  const policy = new CodexModelPolicy(config);
  const result = policy.resolve("implementing", null);
  assert.equal(result.model, "gpt-4-test");
  assert.equal(result.reasoningEffort, "high");
});

test("CodexModelPolicy resolves policy for repairing_ci state", () => {
  const config = createConfig({
    codexModelStrategy: "fixed",
    codexModel: "gpt-4-test",
    codexReasoningEffortByState: { repairing_ci: "medium" },
  });
  const policy = new CodexModelPolicy(config);
  const result = policy.resolve("repairing_ci", null);
  assert.equal(result.model, "gpt-4-test");
  assert.equal(result.reasoningEffort, "medium");
});

test("CodexModelPolicy resolves policy for local_review target", () => {
  const config = createConfig({
    codexModelStrategy: "fixed",
    codexModel: "gpt-4-test",
    codexReasoningEffortByState: { local_review: "low" },
  });
  const policy = new CodexModelPolicy(config);
  const result = policy.resolve("local_review", null, "local_review_generic");
  assert.equal(result.model, "gpt-4-test");
  assert.equal(result.reasoningEffort, "low");
});

test("CodexModelPolicy resolves with inherit strategy returning null model", () => {
  const config = createConfig({
    codexModelStrategy: "inherit",
    codexReasoningEffortByState: {},
  });
  const policy = new CodexModelPolicy(config);
  const result = policy.resolve("planning", null);
  assert.equal(result.model, null);
});

test("CodexModelPolicy resolves with record for reasoning escalation", () => {
  const config = createConfig({
    codexModelStrategy: "fixed",
    codexModel: "gpt-4-test",
    codexReasoningEffortByState: { blocked: "low" },
    codexReasoningEscalateOnRepeatedFailure: true,
  });
  const policy = new CodexModelPolicy(config);
  const result = policy.resolve("blocked", {
    repeated_failure_signature_count: 3,
    blocked_verification_retry_count: 0,
    timeout_retry_count: 0,
    last_tracked_pr_progress_snapshot: null,
    codex_connector_stable_churn_dossier_consumed_signature: null,
  });
  // Reasoning effort should be escalated from "low" due to repeated failures
  assert.notEqual(result.reasoningEffort, "low");
});

test("CodexModelPolicy is accessible from CodexExecutor", () => {
  const config = createConfig();
  const executor = new CodexExecutor({ config });
  assert.ok(executor.modelPolicy instanceof CodexModelPolicy);
  const result = executor.modelPolicy.resolve("planning", null);
  assert.ok(result !== null);
  assert.equal(typeof result.model, "object"); // null or string
  assert.equal(typeof result.reasoningEffort, "string");
});

// ===== CodexOutputParser tests =====

test("CodexOutputParser parses structured result from message", () => {
  const parser = new CodexOutputParser();
  const result = parser.parse([
    "Summary: test implementation",
    "State hint: implementing",
    "Tests: not run",
    "Next action: continue",
  ].join("\n"));
  assert.equal(result?.summary, "test implementation");
  assert.equal(result?.stateHint, "implementing");
  assert.equal(result?.tests, "not run");
  assert.equal(result?.nextAction, "continue");
});

test("CodexOutputParser returns null for empty message", () => {
  const parser = new CodexOutputParser();
  assert.equal(parser.parse(""), null);
});

test("CodexOutputParser returns null for message without structured fields", () => {
  const parser = new CodexOutputParser();
  assert.equal(parser.parse("just some random text without labels"), null);
});

test("CodexOutputParser parses blocked state with reason and signature", () => {
  const parser = new CodexOutputParser();
  const result = parser.parse([
    "Summary: blocked on verification",
    "State hint: blocked",
    "Blocked reason: verification",
    "Failure signature: missing-test",
  ].join("\n"));
  assert.equal(result?.stateHint, "blocked");
  assert.equal(result?.blockedReason, "verification");
  assert.equal(result?.failureSignature, "missing-test");
});

test("CodexOutputParser parses failed state with failure signature", () => {
  const parser = new CodexOutputParser();
  const result = parser.parse([
    "Summary: implementation failed",
    "State hint: failed",
    "Failure signature: compile-error",
  ].join("\n"));
  assert.equal(result?.stateHint, "failed");
  assert.equal(result?.failureSignature, "compile-error");
  assert.equal(result?.blockedReason, null);
});

test("CodexOutputParser is accessible from CodexExecutor", () => {
  const config = createConfig();
  const executor = new CodexExecutor({ config });
  assert.ok(executor.outputParser instanceof CodexOutputParser);
});

// ===== CodexExecutor behavioral parity tests =====

test("CodexExecutor delegates runTurn to underlying runner", async () => {
  const config = createConfig();
  const expected = createTurnResult({ supervisorMessage: "delegated" });
  const mockRunner: AgentRunner = {
    capabilities: { supportsResume: true, supportsStructuredResult: true },
    async runTurn() { return expected; },
  };
  const executor = new CodexExecutor({ config, runner: mockRunner });
  const result = await executor.runTurn(createStartContext(config));
  assert.equal(result.supervisorMessage, "delegated");
  assert.equal(result, expected);
});

test("CodexExecutor with runCodexTurnImpl delegates to mock implementation", async () => {
  const config = createConfig();
  const executor = new CodexExecutor({
    config,
    runCodexTurnImpl: async () => ({
      exitCode: 0,
      sessionId: "mock-session",
      lastMessage: "Summary: mock result\nState hint: done",
      stderr: "",
      stdout: "",
    }),
  });
  const result = await executor.runTurn(createStartContext(config));
  assert.equal(result.exitCode, 0);
  assert.equal(result.sessionId, "mock-session");
  assert.equal(result.failureKind, null);
  assert.equal(result.structuredResult?.summary, "mock result");
  assert.equal(result.structuredResult?.stateHint, "done");
});

test("CodexExecutor produces same capabilities as createCodexAgentRunner + reasoning control", () => {
  const config = createConfig({ codexBinary: "/usr/bin/codex" });
  const runner = createCodexAgentRunner({ config });
  const executor = new CodexExecutor({ config });
  assert.equal(executor.capabilities.supportsResume, runner.capabilities.supportsResume);
  assert.equal(executor.capabilities.supportsStructuredResult, runner.capabilities.supportsStructuredResult);
  assert.equal(executor.capabilities.supportsReasoningControl, true);
});

test("CodexExecutor handles non-zero exit with failure classification", async () => {
  const config = createConfig();
  const executor = new CodexExecutor({
    config,
    runCodexTurnImpl: async () => ({
      exitCode: 1,
      sessionId: "session-fail",
      lastMessage: "Summary: failed",
      stderr: "error output",
      stdout: "",
    }),
  });
  const result = await executor.runTurn(createStartContext(config));
  assert.equal(result.exitCode, 1);
  assert.equal(result.failureKind, "codex_exit");
  assert.equal(result.structuredResult, null);
  assert.ok(result.failureContext !== null);
});

test("CodexExecutor handles timeout errors with correct failure kind", async () => {
  const config = createConfig();
  const executor = new CodexExecutor({
    config,
    runCodexTurnImpl: async () => {
      throw new Error("Command timed out after 1800000ms");
    },
  });
  const result = await executor.runTurn(createStartContext(config));
  assert.equal(result.exitCode, 1);
  assert.equal(result.failureKind, "timeout");
  assert.equal(result.structuredResult, null);
  assert.ok(result.failureContext !== null);
});

test("CodexExecutor preserves sessionId for resume context", async () => {
  const config = createConfig();
  const executor = new CodexExecutor({
    config,
    runCodexTurnImpl: async (_c, _w, _p, _s, _r, sessionId) => ({
      exitCode: 0,
      sessionId: sessionId ?? "new-session",
      lastMessage: "Summary: resumed",
      stderr: "",
      stdout: "",
    }),
  });
  const result = await executor.runTurn({
    kind: "resume",
    config,
    workspacePath: "/tmp/workspace",
    state: "implementing",
    sessionId: "resume-session-id",
    record: null,
    repoSlug: config.repoSlug,
    issue: {
      number: 1,
      title: "Test",
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
  });
  assert.equal(result.sessionId, "resume-session-id");
});

test("CodexExecutor via executorToAgentRunner produces valid AgentRunner", async () => {
  const config = createConfig();
  const executor = new CodexExecutor({
    config,
    runCodexTurnImpl: async () => ({
      exitCode: 0,
      sessionId: "test-session",
      lastMessage: "Summary: adapter test",
      stderr: "",
      stdout: "",
    }),
  });
  const runner = executorToAgentRunner(executor);
  assert.equal(runner.capabilities.supportsResume, executor.capabilities.supportsResume);
  assert.equal(runner.capabilities.supportsStructuredResult, executor.capabilities.supportsStructuredResult);
  const result = await runner.runTurn(createStartContext(config));
  assert.equal(result.sessionId, "test-session");
});

// ===== createExecutor factory tests =====

test("createExecutor returns CodexExecutor for codex binary config", () => {
  const config = createConfig({ codexBinary: "/usr/bin/codex" });
  const executor = createExecutor(config);
  assert.ok(executor instanceof CodexExecutor);
  assert.equal(executor.capabilities.supportsReasoningControl, true);
});

test("createExecutor wraps provided runner with agentRunnerToExecutor", () => {
  const config = createConfig();
  const mockRunner: AgentRunner = {
    capabilities: { supportsResume: false, supportsStructuredResult: false },
    async runTurn() { return createTurnResult(); },
  };
  const executor = createExecutor(config, { runner: mockRunner });
  assert.equal(executor.capabilities.supportsResume, false);
  assert.equal(executor.capabilities.supportsStructuredResult, false);
  assert.equal(executor.capabilities.supportsReasoningControl, false);
});

test("createExecutor returns OpenCodeExecutor for opencode binary (Phase 4)", () => {
  const config = createConfig({ codexBinary: "/usr/bin/opencode" });
  const executor = createExecutor(config);
  assert.ok(executor instanceof (require("./opencode-executor").OpenCodeExecutor));
});

test("createExecutor returns ClaudeCodeExecutor for claude binary (Phase 4)", () => {
  const config = createConfig({ codexBinary: "/usr/bin/claude" });
  const executor = createExecutor(config);
  assert.ok(executor instanceof (require("./claude-code-executor").ClaudeCodeExecutor));
});

test("resolveExecutorKind defaults to codex for unrecognized binary", () => {
  const config = createConfig({ codexBinary: "/usr/bin/custom-tool" });
  assert.equal(resolveExecutorKind(config), "codex");
});

test("resolveExecutorKind detects opencode", () => {
  const config = createConfig({ codexBinary: "/usr/bin/opencode" });
  assert.equal(resolveExecutorKind(config), "opencode");
});

test("resolveExecutorKind detects claude", () => {
  const config = createConfig({ codexBinary: "/usr/bin/claude-code" });
  assert.equal(resolveExecutorKind(config), "claude");
});

test("resolveExecutorKind prefers an explicit executorKind over binary inference", () => {
  // Aliased binary that would otherwise misresolve to codex.
  const config = createConfig({ codexBinary: "/usr/local/bin/oc", executorKind: "opencode" });
  assert.equal(resolveExecutorKind(config), "opencode");
});

test("resolveExecutorKind explicit executorKind overrides a conflicting binary name", () => {
  const config = createConfig({ codexBinary: "/usr/bin/opencode", executorKind: "codex" });
  assert.equal(resolveExecutorKind(config), "codex");
});

test("resolveExecutorKind honors an explicit mock kind, making MockExecutor reachable via createExecutor", () => {
  const config = createConfig({ codexBinary: "/usr/bin/custom-tool", executorKind: "mock" });
  assert.equal(resolveExecutorKind(config), "mock");
  assert.ok(createExecutor(config) instanceof MockExecutor);
});
