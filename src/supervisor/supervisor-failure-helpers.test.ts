import assert from "node:assert/strict";
import test from "node:test";
import { CommandExecutionError } from "../core/command";
import { classifyFailure, classifyTurnError } from "./supervisor-failure-helpers";

function timedOutError(message: string): CommandExecutionError {
  return new CommandExecutionError(message, {
    exitCode: 1,
    stdout: "",
    stderr: "",
    timedOut: true,
  });
}

function nonTimeoutError(message: string): CommandExecutionError {
  return new CommandExecutionError(message, {
    exitCode: 1,
    stdout: "",
    stderr: "",
    timedOut: false,
  });
}

test("classifyTurnError uses the structured timedOut flag even when the message lacks the timeout text", () => {
  // The old substring-only classifier would have returned "command_error" here.
  const error = timedOutError("opencode exited unexpectedly");
  assert.equal(classifyTurnError(error, error.message), "timeout");
});

test("classifyTurnError does not treat a non-timed-out CommandExecutionError as a timeout", () => {
  const error = nonTimeoutError("opencode exited with code 1");
  assert.equal(classifyTurnError(error, error.message), "command_error");
});

test("classifyTurnError falls back to the message substring for non-CommandExecutionError errors", () => {
  const error = new Error("Command timed out after 1800000ms");
  assert.equal(classifyTurnError(error, error.stack ?? error.message), "timeout");

  const other = new Error("network unreachable");
  assert.equal(classifyTurnError(other, other.message), "command_error");
});

test("classifyTurnError uses the injected classifier for the fallback path", () => {
  let received: string | null | undefined = "unset";
  const impl = (message: string | null | undefined): "timeout" | "command_error" => {
    received = message;
    return "command_error";
  };
  const error = new Error("some failure");
  assert.equal(classifyTurnError(error, "some failure", impl), "command_error");
  assert.equal(received, "some failure");
});

test("classifyTurnError short-circuits the timeout flag without consulting the injected classifier", () => {
  let called = false;
  const impl = (): "timeout" | "command_error" => {
    called = true;
    return "command_error";
  };
  const error = timedOutError("aliased binary exited");
  assert.equal(classifyTurnError(error, error.message, impl), "timeout");
  assert.equal(called, false);
});

test("classifyFailure still matches the timeout substring for string-only callers", () => {
  assert.equal(classifyFailure("Command timed out after 5000ms"), "timeout");
  assert.equal(classifyFailure("boom"), "command_error");
  assert.equal(classifyFailure(null), "command_error");
});
