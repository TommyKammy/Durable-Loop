# Architecture

How codex-supervisor structures supervised delivery, trust, and recovery.

## Trust boundary

codex-supervisor draws a hard trust boundary around GitHub-authored text. Issue bodies and review comments are untrusted execution input, never executor policy.

codex-supervisor remains the implementation executor. Codex app Automation is an orchestration boundary and Automation is not an executor replacement: it must not bypass executor safety gates, issue-lint, fresh GitHub PR facts, local CI, or operator confirmations, and it adds no new executor authority and no multi-repo orchestration.

Unsandboxed autonomous execution requires the explicit `--dangerously-bypass-approvals-and-sandbox` opt-in.

## Fresh facts vs cached hydration

Cached pull-request hydration is informational and non-authoritative. Marking a PR ready, advancing or unblocking review-driven state, and merging must use fresh GitHub review facts.

## State recovery

A missing JSON state and a corrupted JSON state are different. A corrupted JSON state is an explicit recovery event and is not safe to treat as durable state. It is not an empty bootstrap.

## Workspace restore precedence

When restoring a workspace, the supervisor prefers a local issue branch, then a remote issue branch, then falls back to `origin/<defaultBranch>` bootstrap as a fallback.

## Workspace cleanup

Orphaned worktrees are preserved when locked, recent, or unsafe_target. An orphaned worktree is pruned only by an explicit operator prune action; codex-supervisor does not prune orphaned worktrees on its own. This is distinct from tracked done worktree cleanup, which retires a worktree after its `done` issue is finalized.
