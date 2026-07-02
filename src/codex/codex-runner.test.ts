import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { mock } from "node:test";
import { runCodexTurn } from "./codex-runner";
import { SupervisorConfig } from "../core/types";

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
      generic: {
        confidenceThreshold: 0.7,
        minimumSeverity: "low",
      },
      specialist: {
        confidenceThreshold: 0.7,
        minimumSeverity: "low",
      },
    },
    localReviewPolicy: "block_ready",
    localReviewHighSeverityAction: "retry",
    reviewBotLogins: [],
    humanReviewBlocksMerge: true,
    issueJournalRelativePath: ".codex-supervisor/issue-journal.md",
    issueJournalMaxChars: 6000,
    candidateDiscoveryFetchWindow: 100,
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

async function writeExecutableScript(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, "utf8");
  await fs.chmod(filePath, 0o755);
}

test("runCodexTurn runs a new Codex exec turn and shapes the result from CLI output", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-runner-test-"));
  const workspacePath = path.join(root, "workspace");
  const executorBinary = path.join(root, "fake-codex.sh");
  const argsPath = path.join(root, "args.log");
  const stdinPath = path.join(root, "stdin.log");
  await fs.mkdir(workspacePath, { recursive: true });

  await writeExecutableScript(
    executorBinary,
    `#!/bin/sh
set -eu
printf '%s\n' "$@" > "${argsPath}"
cat > "${stdinPath}"
out=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    *) shift ;;
  esac
done
printf 'not json\n{"type":"thread.started","thread_id":"thread-new"}\n'
printf 'stderr line\n' >&2
cat <<'EOF' > "$out"

Summary: shaped result
State hint: implementing
Blocked reason: none
Tests: focused
Failure signature: none
Next action: continue

EOF
exit 1
`,
  );

  const result = await runCodexTurn(createConfig({ executorBinary }), workspacePath, "prompt body", "implementing");
  const args = (await fs.readFile(argsPath, "utf8")).trim().split("\n");
  const stdinContent = await fs.readFile(stdinPath, "utf8");

  assert.equal(result.exitCode, 1);
  assert.equal(result.sessionId, "thread-new");
  assert.equal(
    result.lastMessage,
    [
      "Summary: shaped result",
      "State hint: implementing",
      "Blocked reason: none",
      "Tests: focused",
      "Failure signature: none",
      "Next action: continue",
    ].join("\n"),
  );
  assert.match(result.stderr, /stderr line/);
  assert.match(result.stdout, /thread\.started/);
  assert.deepEqual(args.slice(0, 6), [
    "exec",
    "-c",
    'model_reasoning_effort="high"',
    "--json",
    "--dangerously-bypass-approvals-and-sandbox",
    "-C",
  ]);
  assert.equal(args[6], workspacePath);
  assert.equal(args[7], "-o");
  assert.equal(path.basename(args[8] ?? ""), "last-message.txt");
  // The prompt is fed via stdin ("-" instructs Codex to read it from there),
  // not argv, so it doesn't show up in `ps`/`/proc/<pid>/cmdline`.
  assert.equal(args[9], "-");
  assert.equal(args.some((arg) => arg === "prompt body"), false, "the prompt must not appear in argv");
  assert.equal(stdinContent, "prompt body", "the prompt must arrive intact via stdin");
});

test("runCodexTurn resumes an existing Codex session without resetting the workspace arg shape", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-runner-test-"));
  const workspacePath = path.join(root, "workspace");
  const executorBinary = path.join(root, "fake-codex.sh");
  const argsPath = path.join(root, "args.log");
  const stdinPath = path.join(root, "stdin.log");
  await fs.mkdir(workspacePath, { recursive: true });

  await writeExecutableScript(
    executorBinary,
    `#!/bin/sh
set -eu
printf '%s\n' "$@" > "${argsPath}"
cat > "${stdinPath}"
printf 'resume stdout\n'
exit 0
`,
  );

  const result = await runCodexTurn(createConfig({ executorBinary }), workspacePath, "resume prompt", "reproducing", undefined, "session-123");
  const args = (await fs.readFile(argsPath, "utf8")).trim().split("\n");
  const stdinContent = await fs.readFile(stdinPath, "utf8");

  assert.equal(result.exitCode, 0);
  assert.equal(result.sessionId, "session-123");
  assert.equal(result.lastMessage, "");
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /resume stdout/);
  assert.deepEqual(args.slice(0, 6), [
    "exec",
    "resume",
    "-c",
    'model_reasoning_effort="medium"',
    "--json",
    "--dangerously-bypass-approvals-and-sandbox",
  ]);
  assert.equal(args[6], "-o");
  assert.equal(path.basename(args[7] ?? ""), "last-message.txt");
  assert.equal(args[8], "session-123");
  // The prompt is fed via stdin ("-" instructs Codex to read it from there),
  // not argv, so it doesn't show up in `ps`/`/proc/<pid>/cmdline`.
  assert.equal(args[9], "-");
  assert.equal(args.some((arg) => arg === "resume prompt"), false, "the prompt must not appear in argv");
  assert.equal(stdinContent, "resume prompt", "the prompt must arrive intact via stdin");
  assert.equal(args.includes("-C"), false);
});

test("runCodexTurn omits bypass flags when execution safety mode is operator gated", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-runner-test-"));
  const workspacePath = path.join(root, "workspace");
  const executorBinary = path.join(root, "fake-codex.sh");
  const argsPath = path.join(root, "args.log");
  await fs.mkdir(workspacePath, { recursive: true });

  await writeExecutableScript(
    executorBinary,
    `#!/bin/sh
set -eu
printf '%s\n' "$@" > "${argsPath}"
printf 'operator gated stdout\n'
exit 0
`,
  );

  const result = await runCodexTurn(
    createConfig({
      executorBinary,
      executionSafetyMode: "operator_gated",
    }),
    workspacePath,
    "operator gated prompt",
    "implementing",
  );
  const args = (await fs.readFile(argsPath, "utf8")).trim().split("\n");

  assert.equal(result.exitCode, 0);
  assert.equal(args.includes("--dangerously-bypass-approvals-and-sandbox"), false);
  assert.deepEqual(args.slice(0, 5), [
    "exec",
    "-c",
    'model_reasoning_effort="high"',
    "--json",
    "-C",
  ]);
  assert.equal(args[5], workspacePath);
});

test("runCodexTurn removes its temp dir when command execution fails", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "codex-runner-test-"));
  const workspacePath = path.join(root, "workspace");
  const executorBinary = path.join(root, "missing-codex");
  await fs.mkdir(workspacePath, { recursive: true });

  const rmCalls: string[] = [];
  const originalRm = fs.rm.bind(fs);
  const rmMock = mock.method(
    fs,
    "rm",
    async (target: Parameters<typeof fs.rm>[0], options?: Parameters<typeof fs.rm>[1]) => {
      rmCalls.push(String(target));
      return originalRm(target, options);
    },
  );

  try {
    await assert.rejects(
      runCodexTurn(createConfig({ executorBinary }), workspacePath, "prompt body", "implementing"),
      /ENOENT|spawn/i,
    );
  } finally {
    rmMock.mock.restore();
  }

  assert.equal(rmCalls.length, 1);
  assert.match(rmCalls[0] ?? "", /codex-supervisor-/);
});
