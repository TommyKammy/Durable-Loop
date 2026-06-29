/**
 * Parameterized Executor-contract suite.
 *
 * contract.test.ts validates the Executor contract against the MockExecutor
 * only. This suite runs the same assertions against each *real* executor factory
 * (Codex/OpenCode/Claude) with an injected turn implementation, so no real CLI
 * is spawned, plus per-executor CLI-arg assertions.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Executor } from "./types";
import type { AgentTurnResult, StartAgentTurnContext } from "../agent-contract";
import {
  buildOpenCodePermissionArgs,
  buildOpenCodePermissionEnv,
  type ExecutorTurnResult,
} from "./executor-runner";
import type { GitHubIssue, SupervisorConfig } from "../core/types";
import { CodexExecutor } from "./codex-executor";
import { createExecutor } from "./executor";
import { OpenCodeExecutor, buildOpenCodeArgs } from "./opencode-executor";
import { ClaudeCodeExecutor, buildClaudeCodeArgs } from "./claude-code-executor";
import {
  buildCodexConfigOverrideArgs,
  buildCodexExecutionSafetyArgs,
  resolveCodexExecutionPolicy,
} from "../codex/codex-policy";

function createConfig(overrides: Partial<SupervisorConfig> = {}): SupervisorConfig {
  return {
    repoPath: "/tmp/repo",
    repoSlug: "owner/repo",
    defaultBranch: "main",
    workspaceRoot: "/tmp/workspaces",
    stateBackend: "json",
    stateFile: "/tmp/state.json",
    executorBinary: "/usr/bin/codex",
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

function createStartContext(config: SupervisorConfig): StartAgentTurnContext {
  const issue: GitHubIssue = {
    number: 102,
    title: "Exercise the executor contract",
    body: "## Summary\nRun the shared contract assertions.",
    createdAt: "2026-03-16T00:00:00Z",
    updatedAt: "2026-03-16T00:00:00Z",
    url: "https://example.test/issues/102",
  };
  return {
    kind: "start",
    config,
    workspacePath: "/tmp/workspace",
    state: "implementing",
    record: null,
    repoSlug: config.repoSlug,
    issue,
    branch: "codex/issue-102",
    pr: null,
    checks: [],
    reviewThreads: [],
    alwaysReadFiles: [],
    onDemandMemoryFiles: [],
    journalPath: "/tmp/workspace/.codex-supervisor/issue-journal.md",
    journalExcerpt: null,
    failureContext: null,
    previousSummary: null,
    previousError: null,
  };
}

const fixedCaps = { supportsResume: true, supportsStructuredResult: true };

interface TurnStub {
  exitCode: number;
  sessionId: string | null;
  lastMessage: string;
  stderr?: string;
  stdout?: string;
}

function stub(turn: TurnStub): ExecutorTurnResult {
  return {
    exitCode: turn.exitCode,
    sessionId: turn.sessionId,
    lastMessage: turn.lastMessage,
    stderr: turn.stderr ?? "",
    stdout: turn.stdout ?? "",
  };
}

interface ContractCase {
  name: string;
  make(config: SupervisorConfig, turn: TurnStub): Executor;
}

const cases: ContractCase[] = [
  {
    name: "CodexExecutor",
    make: (config, turn) =>
      new CodexExecutor({
        config,
        probeCapabilitiesImpl: () => fixedCaps,
        runCodexTurnImpl: async () => stub(turn),
      }),
  },
  {
    name: "OpenCodeExecutor",
    make: (config, turn) =>
      new OpenCodeExecutor({
        config,
        probeCapabilitiesImpl: () => fixedCaps,
        runTurnImpl: async () => stub(turn),
      }),
  },
  {
    name: "ClaudeCodeExecutor",
    make: (config, turn) =>
      new ClaudeCodeExecutor({
        config,
        probeCapabilitiesImpl: () => fixedCaps,
        runTurnImpl: async () => stub(turn),
      }),
  },
];

function assertWellFormed(result: AgentTurnResult): void {
  assert.equal(typeof result.exitCode, "number");
  assert.ok(result.sessionId === null || typeof result.sessionId === "string");
  assert.equal(typeof result.supervisorMessage, "string");
  assert.equal(typeof result.stderr, "string");
  assert.equal(typeof result.stdout, "string");
  assert.ok(result.structuredResult === null || typeof result.structuredResult === "object");
  assert.ok(result.failureKind === null || typeof result.failureKind === "string");
  assert.ok(result.failureContext === null || typeof result.failureContext === "object");
}

for (const executorCase of cases) {
  describe(`Executor contract: ${executorCase.name}`, () => {
    test("exposes boolean capabilities and a runTurn function", () => {
      const executor = executorCase.make(createConfig(), {
        exitCode: 0,
        sessionId: "s",
        lastMessage: "Summary: ok",
      });
      assert.equal(typeof executor.capabilities.supportsResume, "boolean");
      assert.equal(typeof executor.capabilities.supportsStructuredResult, "boolean");
      assert.ok(
        executor.capabilities.supportsReasoningControl === undefined ||
          typeof executor.capabilities.supportsReasoningControl === "boolean",
      );
      assert.equal(typeof executor.runTurn, "function");
    });

    test("runTurn returns a well-formed AgentTurnResult on a successful turn", async () => {
      const executor = executorCase.make(createConfig(), {
        exitCode: 0,
        sessionId: "session-1",
        lastMessage: ["Summary: did the thing", "State hint: implementing"].join("\n"),
      });
      const result = await executor.runTurn(createStartContext(createConfig()));

      assertWellFormed(result);
      assert.equal(result.exitCode, 0);
      assert.equal(result.failureKind, null);
      assert.equal(result.failureContext, null);
      assert.equal(result.sessionId, "session-1");
      assert.equal(result.supervisorMessage.includes("did the thing"), true);
      assert.equal(result.structuredResult?.summary, "did the thing");
    });

    test("runTurn surfaces a bounded failure on a non-zero turn", async () => {
      const executor = executorCase.make(createConfig(), {
        exitCode: 1,
        sessionId: null,
        lastMessage: "broken",
        stderr: "stderr noise",
      });
      const result = await executor.runTurn(createStartContext(createConfig()));

      assertWellFormed(result);
      assert.equal(result.exitCode, 1);
      assert.notEqual(result.failureKind, null);
      assert.ok(result.failureContext, "a non-zero turn must carry failure context");
      // Failures must not also masquerade as a structured success.
      assert.equal(result.structuredResult, null);
    });
  });
}

describe("CLI arg construction", () => {
  function flagValue(args: string[], flag: string): string | undefined {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  }

  test("OpenCodeExecutor builds correct CLI args", () => {
    const config = createConfig({ codexModelStrategy: "fixed", codexModel: "anthropic/claude-sonnet" });
    const args = buildOpenCodeArgs(config, "/ws", "PROMPT", "implementing", "sess-1");

    assert.deepEqual(args.slice(0, 3), ["run", "--format", "json"]);
    assert.equal(flagValue(args, "--model"), "anthropic/claude-sonnet");
    assert.equal(flagValue(args, "--session"), "sess-1");
    assert.equal(flagValue(args, "--dir"), "/ws");
    assert.ok(args.includes("--dangerously-skip-permissions"));
    assert.equal(args[args.length - 1], "PROMPT");

    // No session flag when resuming is not requested.
    const fresh = buildOpenCodeArgs(createConfig(), "/ws", "PROMPT", "implementing");
    assert.equal(fresh.includes("--session"), false);

    // operator_gated omits the bypass flag so OpenCode's own opencode.json
    // allow/ask/deny rules govern.
    const gated = buildOpenCodeArgs(
      createConfig({ executionSafetyMode: "operator_gated" }),
      "/ws",
      "PROMPT",
      "implementing",
    );
    assert.equal(gated.includes("--dangerously-skip-permissions"), false);
  });

  test("ClaudeCodeExecutor builds correct CLI args", () => {
    const config = createConfig({ codexModelStrategy: "fixed", codexModel: "claude-opus" });
    const args = buildClaudeCodeArgs(config, "/ws", "PROMPT", "implementing", "sess-1");

    assert.deepEqual(args.slice(0, 3), ["-p", "--output-format", "json"]);
    assert.equal(flagValue(args, "--model"), "claude-opus");
    assert.equal(flagValue(args, "--resume"), "sess-1");
    assert.equal(flagValue(args, "--add-dir"), "/ws");
    assert.ok(args.includes("--dangerously-skip-permissions"));
    assert.equal(args[args.length - 1], "PROMPT");

    const fresh = buildClaudeCodeArgs(createConfig(), "/ws", "PROMPT", "implementing");
    assert.equal(fresh.includes("--resume"), false);
  });

  test("buildOpenCodePermissionArgs omits the bypass flag only when operator-gated", () => {
    assert.deepEqual(buildOpenCodePermissionArgs({ executionSafetyMode: "unsandboxed_autonomous" }), [
      "--dangerously-skip-permissions",
    ]);
    assert.deepEqual(buildOpenCodePermissionArgs({ executionSafetyMode: "operator_gated" }), []);
  });

  test("buildOpenCodePermissionEnv injects a deny policy only when operator-gated", () => {
    assert.deepEqual(buildOpenCodePermissionEnv({ executionSafetyMode: "unsandboxed_autonomous" }), {});

    const env = buildOpenCodePermissionEnv({ executionSafetyMode: "operator_gated" });
    assert.ok(env.OPENCODE_CONFIG_CONTENT, "expected an inline OpenCode config to be injected");
    const policy = JSON.parse(env.OPENCODE_CONFIG_CONTENT as string) as {
      permission: Record<string, string>;
    };
    // Mutations, shell, network and out-of-workspace access are denied (a static,
    // non-interactive gate that does not depend on a repo opencode.json).
    for (const tool of ["edit", "bash", "webfetch", "external_directory"]) {
      assert.equal(policy.permission[tool], "deny", `${tool} must be denied under operator_gated`);
    }
  });

  test("createExecutor rejects operator_gated for the Claude executor (no non-interactive approval channel)", () => {
    assert.throws(
      () =>
        createExecutor(
          createConfig({ executorBinary: "/usr/bin/claude", executionSafetyMode: "operator_gated" }),
        ),
      /operator_gated is not supported with the Claude Code executor/,
    );
    // Codex and OpenCode remain usable under operator_gated.
    assert.doesNotThrow(() =>
      createExecutor(createConfig({ executorBinary: "/usr/bin/opencode", executionSafetyMode: "operator_gated" })),
    );
  });

  test("CodexExecutor builds correct CLI args (via the Codex policy builders it delegates to)", () => {
    const policy = resolveCodexExecutionPolicy(
      createConfig({ codexModelStrategy: "fixed", codexModel: "gpt-5-codex" }),
      "implementing",
      null,
    );
    const overrideArgs = buildCodexConfigOverrideArgs(policy);
    assert.equal(overrideArgs.indexOf("-m") !== -1, true);
    assert.equal(overrideArgs[overrideArgs.indexOf("-m") + 1], "gpt-5-codex");
    assert.ok(overrideArgs.some((arg) => arg.startsWith("model_reasoning_effort=")));

    // Default (non-operator-gated) execution bypasses approvals; operator-gated does not.
    assert.deepEqual(buildCodexExecutionSafetyArgs(createConfig()), [
      "--dangerously-bypass-approvals-and-sandbox",
    ]);
    assert.deepEqual(
      buildCodexExecutionSafetyArgs(createConfig({ executionSafetyMode: "operator_gated" })),
      [],
    );
  });
});
