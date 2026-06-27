import assert from "node:assert/strict";
import test from "node:test";
import { createExecutorAgentRunner, type ExecutorTurnResult } from "./executor-runner";
import { GenericPromptBuilder } from "./prompt-builder";

const noopTurn = async (): Promise<ExecutorTurnResult> => ({
  exitCode: 0,
  sessionId: null,
  lastMessage: "",
  stderr: "",
  stdout: "",
});

const capabilities = { supportsResume: true, supportsStructuredResult: true };

test("createExecutorAgentRunner accepts an explicit promptBuilder", () => {
  const runner = createExecutorAgentRunner({
    runTurnImpl: noopTurn,
    capabilities,
    providerName: "OpenCode",
    promptBuilder: new GenericPromptBuilder("OpenCode"),
  });
  assert.equal(runner.capabilities.supportsResume, true);
});

test("createExecutorAgentRunner requires a promptBuilder (no silent Codex default)", () => {
  // The provider-neutral runner has no safe prompt-builder default: omitting it
  // must be a compile error rather than silently emitting Codex-branded prompts.
  // @ts-expect-error promptBuilder is required.
  createExecutorAgentRunner({
    runTurnImpl: noopTurn,
    capabilities,
    providerName: "OpenCode",
  });
  assert.ok(true);
});
