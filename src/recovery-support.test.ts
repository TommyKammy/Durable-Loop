import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCommand } from "./core/command";
import { classifyFailedNoPrBranchRecovery, shouldAutoRecoverFailedNoPr } from "./recovery-support";
import { createConfig, createRecord } from "./turn-execution-test-helpers";

async function createRepositoryWithOrigin(): Promise<{ repoPath: string; workspaceRoot: string }> {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), "codex-supervisor-recovery-support-"));
  const remotePath = path.join(rootPath, "remote.git");
  const repoPath = path.join(rootPath, "repo");
  const workspaceRoot = path.join(rootPath, "workspaces");

  await runCommand("git", ["init", "--bare", remotePath]);
  await runCommand("git", ["init", "--initial-branch", "main", repoPath]);
  await runCommand("git", ["-C", repoPath, "config", "user.name", "Codex Test"]);
  await runCommand("git", ["-C", repoPath, "config", "user.email", "codex@example.test"]);
  await fs.writeFile(path.join(repoPath, "README.md"), "initial\n");
  await runCommand("git", ["-C", repoPath, "add", "README.md"]);
  await runCommand("git", ["-C", repoPath, "commit", "-m", "initial"]);
  await runCommand("git", ["-C", repoPath, "remote", "add", "origin", remotePath]);
  await runCommand("git", ["-C", repoPath, "push", "-u", "origin", "main"]);

  return { repoPath, workspaceRoot };
}

test("classifyFailedNoPrBranchRecovery identifies a clean preserved branch ahead of origin/main as recoverable", async (t) => {
  const { repoPath, workspaceRoot } = await createRepositoryWithOrigin();
  const rootPath = path.dirname(repoPath);
  t.after(async () => {
    await fs.rm(rootPath, { recursive: true, force: true });
  });

  const branch = "codex/issue-366";
  const workspacePath = path.join(workspaceRoot, "issue-366");
  await fs.mkdir(workspaceRoot, { recursive: true });
  await runCommand("git", ["-C", repoPath, "worktree", "add", "-b", branch, workspacePath, "main"]);
  await fs.writeFile(path.join(workspacePath, "feature.txt"), "meaningful change\n");
  await runCommand("git", ["-C", workspacePath, "add", "feature.txt"]);
  await runCommand("git", ["-C", workspacePath, "commit", "-m", "meaningful checkpoint"]);
  const headSha = (await runCommand("git", ["-C", workspacePath, "rev-parse", "HEAD"])).stdout.trim();

  let fetchCount = 0;
  const config = createConfig({
    repoPath,
    workspaceRoot,
  });
  const record = createRecord({
    issue_number: 366,
    branch,
    workspace: workspacePath,
  });

  const result = await classifyFailedNoPrBranchRecovery({
    config,
    record,
    ensureOriginDefaultBranchFetched: async () => {
      fetchCount += 1;
      await runCommand("git", ["-C", repoPath, "fetch", "origin", config.defaultBranch]);
    },
    isSafeCleanupTarget: (currentConfig, currentWorkspacePath, currentBranch) =>
      currentWorkspacePath === workspacePath
      && currentBranch === branch
      && currentConfig.workspaceRoot === workspaceRoot,
  });

  assert.deepEqual(result, {
    state: "recoverable",
    headSha,
  });
  assert.equal(fetchCount, 1);
});

test("classifyFailedNoPrBranchRecovery reports preserved tracked files when dirty tracked work blocks automatic recovery", async (t) => {
  const { repoPath, workspaceRoot } = await createRepositoryWithOrigin();
  const rootPath = path.dirname(repoPath);
  t.after(async () => {
    await fs.rm(rootPath, { recursive: true, force: true });
  });

  const branch = "codex/issue-367";
  const workspacePath = path.join(workspaceRoot, "issue-367");
  await fs.mkdir(workspaceRoot, { recursive: true });
  await runCommand("git", ["-C", repoPath, "worktree", "add", "-b", branch, workspacePath, "main"]);
  await fs.writeFile(path.join(workspacePath, "feature.txt"), "meaningful change\n");
  await runCommand("git", ["-C", workspacePath, "add", "feature.txt"]);
  await runCommand("git", ["-C", workspacePath, "commit", "-m", "meaningful checkpoint"]);
  await fs.writeFile(path.join(workspacePath, "feature.txt"), "meaningful change\ndirty edit\n");
  const headSha = (await runCommand("git", ["-C", workspacePath, "rev-parse", "HEAD"])).stdout.trim();

  const config = createConfig({
    repoPath,
    workspaceRoot,
  });
  const record = createRecord({
    issue_number: 367,
    branch,
    workspace: workspacePath,
  });

  const result = await classifyFailedNoPrBranchRecovery({
    config,
    record,
    ensureOriginDefaultBranchFetched: async () => {
      await runCommand("git", ["-C", repoPath, "fetch", "origin", config.defaultBranch]);
    },
    isSafeCleanupTarget: (currentConfig, currentWorkspacePath, currentBranch) =>
      currentWorkspacePath === workspacePath
      && currentBranch === branch
      && currentConfig.workspaceRoot === workspaceRoot,
  });

  assert.deepEqual(result, {
    state: "dirty_workspace",
    headSha,
    preservedTrackedFiles: ["feature.txt"],
  });
});

test("classifyFailedNoPrBranchRecovery does not treat untracked-only workspace files as preserved tracked work", async (t) => {
  const { repoPath, workspaceRoot } = await createRepositoryWithOrigin();
  const rootPath = path.dirname(repoPath);
  t.after(async () => {
    await fs.rm(rootPath, { recursive: true, force: true });
  });

  const branch = "codex/issue-368";
  const workspacePath = path.join(workspaceRoot, "issue-368");
  await fs.mkdir(workspaceRoot, { recursive: true });
  await runCommand("git", ["-C", repoPath, "worktree", "add", "-b", branch, workspacePath, "main"]);
  await fs.writeFile(path.join(workspacePath, "scratch.txt"), "untracked work\n");
  const headSha = (await runCommand("git", ["-C", workspacePath, "rev-parse", "HEAD"])).stdout.trim();

  const config = createConfig({
    repoPath,
    workspaceRoot,
  });
  const record = createRecord({
    issue_number: 368,
    branch,
    workspace: workspacePath,
  });

  const result = await classifyFailedNoPrBranchRecovery({
    config,
    record,
    ensureOriginDefaultBranchFetched: async () => {
      await runCommand("git", ["-C", repoPath, "fetch", "origin", config.defaultBranch]);
    },
    isSafeCleanupTarget: (currentConfig, currentWorkspacePath, currentBranch) =>
      currentWorkspacePath === workspacePath
      && currentBranch === branch
      && currentConfig.workspaceRoot === workspaceRoot,
  });

  assert.deepEqual(result, {
    state: "dirty_workspace",
    headSha,
    preservedTrackedFiles: [],
  });
});

test("shouldAutoRecoverFailedNoPr excludes both codex_failed and executor_failed terminal failures", () => {
  const config = createConfig();
  const base = {
    state: "failed" as const,
    pr_number: null,
    stale_stabilizing_no_pr_recovery_count: 0,
  };

  // A recoverable failed no-PR record (a non-terminal failure kind).
  assert.equal(
    shouldAutoRecoverFailedNoPr(createRecord({ ...base, last_failure_kind: "command_error" }), config),
    true,
  );
  // Terminal executor-reported failures must not be auto-recovered, for either
  // the Codex value or the executor-neutral value.
  assert.equal(
    shouldAutoRecoverFailedNoPr(createRecord({ ...base, last_failure_kind: "codex_failed" }), config),
    false,
  );
  assert.equal(
    shouldAutoRecoverFailedNoPr(createRecord({ ...base, last_failure_kind: "executor_failed" }), config),
    false,
  );
});
