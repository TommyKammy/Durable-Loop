# Codex app Automation Boundary

Codex app Automation is an orchestration boundary around codex-supervisor. codex-supervisor remains the implementation executor. Automation is not an executor replacement: it evaluates, routes, drafts, records, and notifies, but it must not bypass the executor safety gates, issue-lint, fresh GitHub PR facts, local CI, or operator confirmations. It adds no new executor authority and no multi-repo orchestration to core.

## Orchestration roles

- **Loop Watcher** — watches loop runtime state and stays quiet when there is no actionable change.
- **Merge Evaluator** — evaluates merge readiness from fresh GitHub PR facts and is confirm-required for any operator-visible action.
- **Follow-up Issue Creator** — drafts confirm-required follow-up issues only; it performs no destructive git operations.
- **Obsidian Recorder** — records durable external history and must respect core safety gates.

## Boundary rules

- Stay quiet when there is no actionable change.
- Every operator-visible action is confirm-required.
- No destructive git operations.
- Respect core safety gates at all times.

## Out of scope (forbidden expansions)

- default-enabled follow-up issue creation
- metadata-only review auto-resolve
- broad path repair
- multi-user governance

## Phase 5 Boundary Inventory

See [Phase 5 closeout evidence](./phase5-closeout-evidence.md) for the verified closeout record.

Core responsibilities that stay inside codex-supervisor:

- issue contract validation and `issue-lint` readiness
- per-issue worktree and journal ownership
- Codex execution and resume orchestration
- PR lifecycle action selection
- CI, review, branch-protection, head-SHA, and merge safety gates
- evidence capture, replay, status, and explain output

External orchestration responsibilities (Codex app Automation):

- evaluate roadmap, GitHub, local status, and note state
- route actionable changes to the operator or the next runnable issue
- draft confirm-required follow-up issues
- record durable Obsidian or external history
- notify the operator about actionable state changes
- prepare operator-facing evidence

Unchanged boundaries: external orchestration does not replace issue selection, Codex execution, merge execution, branch protection, or the final auto-merge guard. It cannot authorize implementation turns, GitHub mutations, or safety-gate bypasses.
