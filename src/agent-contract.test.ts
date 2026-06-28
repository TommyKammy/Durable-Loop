import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
// Compile-time check that the contract types are exported from agent-contract.
import type {
  AgentRunner,
  AgentRunnerCapabilities,
  AgentTurnContext,
  AgentTurnResult,
  AgentTurnStructuredResult,
} from "./agent-contract";
// Backward-compat: the same types remain importable from supervisor/agent-runner.
import type {
  AgentRunner as ReexportedRunner,
  AgentTurnContext as ReexportedContext,
} from "./supervisor/agent-runner";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("agent-contract does not depend on the supervisor or executors layers", () => {
  const source = readSource("src/agent-contract.ts");
  assert.doesNotMatch(source, /from "\.\/supervisor\//, "agent-contract must not import the supervisor layer");
  assert.doesNotMatch(source, /from "\.\/executors\//, "agent-contract must not import the executors layer");
});

test("executors/types.ts sources the agent contract from agent-contract, not the supervisor layer", () => {
  const source = readSource("src/executors/types.ts");
  assert.match(source, /from "\.\.\/agent-contract"/);
  assert.doesNotMatch(
    source,
    /from "\.\.\/supervisor\/agent-runner"/,
    "the executor layer must not import the agent contract from the higher-level supervisor module",
  );
});

test("contract types remain importable from both agent-contract and supervisor/agent-runner (backward compat)", () => {
  // Purely a type-level assertion; if these aliases resolve, both paths export
  // the contract. The runtime body just needs to exist.
  const runner: AgentRunner | ReexportedRunner | null = null;
  const context: AgentTurnContext | ReexportedContext | null = null;
  const _caps: AgentRunnerCapabilities | null = null;
  const _result: AgentTurnResult | null = null;
  const _structured: AgentTurnStructuredResult | null = null;
  assert.equal(runner, null);
  assert.equal(context, null);
});
