import assert from "node:assert/strict";
import test from "node:test";
import {
  createExecutorAgentRunner,
  runExecutorCliCommand,
  type ExecutorTurnResult,
} from "./executor-runner";
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

test("runExecutorCliCommand bounds stdout capture so runaway output cannot grow unbounded", async () => {
  const produced = 200_000;
  const limit = 4_000;
  const result = await runExecutorCliCommand(
    process.execPath,
    ["-e", `process.stdout.write("x".repeat(${produced}))`],
    {
      cwd: process.cwd(),
      timeoutMs: 30_000,
      parseJsonOutput: false,
      stdoutCaptureLimitBytes: limit,
    },
  );

  assert.equal(result.exitCode, 0);
  // Bounded well below the produced size (a small margin for the truncation marker).
  assert.ok(
    result.stdout.length <= limit + 16,
    `expected bounded stdout (<= ${limit + 16}), got ${result.stdout.length}`,
  );
});

test("runExecutorCliCommand fails a JSON turn whose oversized single object was truncated", async () => {
  // A single JSON object larger than the cap: truncation cuts its middle, so no
  // structured result can be parsed. This must be a bounded failure, not a
  // corrupt success with empty session/message.
  const result = await runExecutorCliCommand(
    process.execPath,
    ["-e", `process.stdout.write('{"result":"' + 'a'.repeat(200000) + '"}')`],
    {
      cwd: process.cwd(),
      timeoutMs: 30_000,
      parseJsonOutput: true,
      stdoutCaptureLimitBytes: 4_000,
    },
  );

  assert.equal(result.exitCode, 1, "truncated unparseable JSON should be a failure");
  assert.equal(result.lastMessage, "");
  assert.match(result.stderr, /capture limit/);
});

test("runExecutorCliCommand fails a truncated JSONL turn even when a stale early message survives", async () => {
  // An early assistant message survives in the preserved head, but the final
  // result line is cut by truncation. The recovered lastMessage is stale, so the
  // turn must still fail rather than continue with stale structured state.
  const source =
    `process.stdout.write('{"type":"assistant","content":"early stale message"}\\n'` +
    ` + 'a'.repeat(200000)` +
    ` + '\\n{"type":"result","result":"final"}')`;
  const result = await runExecutorCliCommand(process.execPath, ["-e", source], {
    cwd: process.cwd(),
    timeoutMs: 30_000,
    parseJsonOutput: true,
    stdoutCaptureLimitBytes: 4_000,
  });

  assert.equal(result.exitCode, 1, "truncated JSONL should fail even with a surviving early message");
  assert.match(result.stderr, /capture limit/);
});
