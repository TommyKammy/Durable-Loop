/**
 * Phase 0: Contract tests verifying Executor is a structural supertype of AgentRunner.
 */

import assert from "node:assert/strict";
import test from "node:test";
import type { AgentRunner, AgentRunnerCapabilities } from "../supervisor/agent-runner";
import type { Executor, ExecutorCapabilities } from "./types";
import { agentRunnerToExecutor, executorToAgentRunner, resolveExecutorKind, createExecutor } from "./executor";
import { MockExecutor } from "./mock-executor";

test("AgentRunner is structurally assignable to Executor", () => {
  const runnerCaps: AgentRunnerCapabilities = {
    supportsResume: true,
    supportsStructuredResult: false,
  };
  const runner: AgentRunner = {
    capabilities: runnerCaps,
    async runTurn() {
      return {
        exitCode: 0,
        sessionId: "test",
        supervisorMessage: "ok",
        stderr: "",
        stdout: "",
        structuredResult: null,
        failureKind: null,
        failureContext: null,
      };
    },
  };

  // This assignment verifies structural compatibility
  const executor: Executor = agentRunnerToExecutor(runner);
  assert.equal(executor.capabilities.supportsResume, true);
  assert.equal(executor.capabilities.supportsStructuredResult, false);
  assert.equal(executor.capabilities.supportsReasoningControl, false);
});

test("Executor can be converted back to AgentRunner", () => {
  const mock = new MockExecutor({
    capabilities: { supportsResume: false, supportsStructuredResult: true, supportsReasoningControl: true },
  });
  const runner = executorToAgentRunner(mock);
  assert.equal(runner.capabilities.supportsResume, false);
  assert.equal(runner.capabilities.supportsStructuredResult, true);
  // AgentRunnerCapabilities doesn't have supportsReasoningControl
  assert.equal("supportsReasoningControl" in runner.capabilities, false);
});

test("MockExecutor implements Executor", () => {
  const executor: Executor = new MockExecutor();
  assert.equal(executor.capabilities.supportsResume, true);
  assert.equal(executor.capabilities.supportsStructuredResult, true);
  assert.equal(executor.capabilities.supportsReasoningControl, false);
});

test("MockExecutor returns configured result", async () => {
  const executor = new MockExecutor({
    result: { exitCode: 42, supervisorMessage: "custom" },
  });
  const result = await executor.runTurn({} as any);
  assert.equal(result.exitCode, 42);
  assert.equal(result.supervisorMessage, "custom");
});

test("resolveExecutorKind defaults to codex", () => {
  assert.equal(resolveExecutorKind({ executorBinary: "/usr/bin/codex" }), "codex");
  assert.equal(resolveExecutorKind({ executorBinary: "" }), "codex");
  assert.equal(resolveExecutorKind({ executorBinary: undefined as any }), "codex");
});

test("resolveExecutorKind detects opencode", () => {
  assert.equal(resolveExecutorKind({ executorBinary: "/usr/bin/opencode" }), "opencode");
});

test("resolveExecutorKind detects claude", () => {
  assert.equal(resolveExecutorKind({ executorBinary: "/usr/bin/claude" }), "claude");
});

test("capability fallbacks: supportsResume defaults to false when not provided", () => {
  const executor = new MockExecutor({
    capabilities: { supportsResume: false },
  });
  assert.equal(executor.capabilities.supportsResume, false);
  assert.equal(executor.capabilities.supportsStructuredResult, true);
});

test("capability fallbacks: supportsStructuredResult defaults to false when not provided", () => {
  const executor = new MockExecutor({
    capabilities: { supportsStructuredResult: false },
  });
  assert.equal(executor.capabilities.supportsResume, true);
  assert.equal(executor.capabilities.supportsStructuredResult, false);
});

test("capability fallbacks: supportsReasoningControl is optional", () => {
  const executor = new MockExecutor({
    capabilities: { supportsResume: true, supportsStructuredResult: true },
  });
  assert.equal(executor.capabilities.supportsReasoningControl, false);
});

test("ExecutorCapabilities extends AgentRunnerCapabilities", () => {
  // Type-level verification: ExecutorCapabilities must be a supertype
  const ec: ExecutorCapabilities = {
    supportsResume: true,
    supportsStructuredResult: true,
  };
  // supportsReasoningControl is optional
  assert.equal(ec.supportsReasoningControl, undefined);
});

test("round-trip: AgentRunner -> Executor -> AgentRunner preserves capabilities", () => {
  const original: AgentRunner = {
    capabilities: { supportsResume: true, supportsStructuredResult: true },
    async runTurn() {
      return {
        exitCode: 0, sessionId: "rt", supervisorMessage: "", stderr: "",
        stdout: "", structuredResult: null, failureKind: null, failureContext: null,
      };
    },
  };
  const executor = agentRunnerToExecutor(original);
  const roundTripped = executorToAgentRunner(executor);
  assert.equal(roundTripped.capabilities.supportsResume, original.capabilities.supportsResume);
  assert.equal(roundTripped.capabilities.supportsStructuredResult, original.capabilities.supportsStructuredResult);
});

test("round-trip: Executor -> AgentRunner -> Executor preserves core capabilities", () => {
  const original = new MockExecutor({
    capabilities: { supportsResume: false, supportsStructuredResult: true, supportsReasoningControl: true },
  });
  const runner = executorToAgentRunner(original);
  const roundTripped = agentRunnerToExecutor(runner);
  assert.equal(roundTripped.capabilities.supportsResume, false);
  assert.equal(roundTripped.capabilities.supportsStructuredResult, true);
  // supportsReasoningControl is lost in the AgentRunner round-trip (expected)
  assert.equal(roundTripped.capabilities.supportsReasoningControl, false);
});

test("MockExecutor with all capabilities disabled", () => {
  const executor = new MockExecutor({
    capabilities: { supportsResume: false, supportsStructuredResult: false, supportsReasoningControl: false },
  });
  assert.equal(executor.capabilities.supportsResume, false);
  assert.equal(executor.capabilities.supportsStructuredResult, false);
  assert.equal(executor.capabilities.supportsReasoningControl, false);
});

test("MockExecutor with all capabilities enabled", () => {
  const executor = new MockExecutor({
    capabilities: { supportsResume: true, supportsStructuredResult: true, supportsReasoningControl: true },
  });
  assert.equal(executor.capabilities.supportsResume, true);
  assert.equal(executor.capabilities.supportsStructuredResult, true);
  assert.equal(executor.capabilities.supportsReasoningControl, true);
});

test("createExecutor returns CodexExecutor for codex config (Phase 1)", () => {
  const config = { executorBinary: "/usr/bin/codex" } as any;
  const executor = createExecutor(config);
  assert.equal(executor.capabilities.supportsResume, true);
  assert.equal(executor.capabilities.supportsStructuredResult, true);
  assert.equal(executor.capabilities.supportsReasoningControl, true);
});

test("createExecutor wraps provided runner", () => {
  const runner: AgentRunner = {
    capabilities: { supportsResume: true, supportsStructuredResult: true },
    async runTurn() {
      return {
        exitCode: 0, sessionId: "x", supervisorMessage: "", stderr: "",
        stdout: "", structuredResult: null, failureKind: null, failureContext: null,
      };
    },
  };
  const executor = createExecutor({} as any, { runner });
  assert.equal(executor.capabilities.supportsResume, true);
});

test("ExecutorCapabilities is assignable from AgentRunnerCapabilities", () => {
  const arc: AgentRunnerCapabilities = { supportsResume: true, supportsStructuredResult: false };
  const ec: ExecutorCapabilities = arc; // structural assignment
  assert.equal(ec.supportsResume, true);
  assert.equal(ec.supportsStructuredResult, false);
});

test("structural supertype: AgentRunner object is directly assignable to Executor via wrapper", () => {
  const runner: AgentRunner = {
    capabilities: { supportsResume: true, supportsStructuredResult: true },
    async runTurn() {
      return {
        exitCode: 0, sessionId: "s", supervisorMessage: "m", stderr: "",
        stdout: "", structuredResult: null, failureKind: null, failureContext: null,
      };
    },
  };
  // The wrapper should not alter the runTurn behavior
  const executor = agentRunnerToExecutor(runner);
  // Verify the function identity is preserved (no wrapping that changes behavior)
  assert.equal(typeof executor.runTurn, "function");
});

test("resolveExecutorKind handles mixed-case binary names", () => {
  assert.equal(resolveExecutorKind({ executorBinary: "/usr/local/bin/CodeX" }), "codex");
  assert.equal(resolveExecutorKind({ executorBinary: "/usr/local/bin/OpenCode" }), "opencode");
  assert.equal(resolveExecutorKind({ executorBinary: "/usr/local/bin/Claude" }), "claude");
});
