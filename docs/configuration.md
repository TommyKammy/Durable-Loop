# Configuration reference

How to configure trust posture, execution safety, model routing, local CI, and recovery behavior.

## Profile selection

The active config is whichever file you pass with `--config`. Shipped profiles include `supervisor.config.codex.json`, `supervisor.config.coderabbit.json`, and `supervisor.config.copilot.json`.

## Model routing

Set `codexModelStrategy: "inherit"` (recommended) to follow the host Codex CLI/App default model. Use `fixed` only when you must ignore, override, or pin a specific model instead of the host default model.

## Trust mode and execution safety mode combinations

A trusted repo with trusted authors is the safe baseline. Unsandboxed autonomous execution requires the explicit `--dangerously-bypass-approvals-and-sandbox` opt-in, which removes the sandbox and approval gates.

| trustMode | executionSafetyMode | Posture | Operator meaning | Status and doctor vocabulary |
| --- | --- | --- | --- | --- |
| `trusted_repo_and_authors` | `operator_gated` | Safe | Default safe posture | `trust_mode=trusted_repo_and_authors` |
| `untrusted_or_mixed` | `operator_gated` | Cautious | Treat inputs as untrusted | `execution_safety_mode=operator_gated` |
| `trusted_repo_and_authors` | `unsandboxed_autonomous` | Dangerous opt-in | Explicit unsandboxed opt-in | `doctor_posture=dangerous` |
| `untrusted_or_mixed` | `unsandboxed_autonomous` | Dangerous | Strongly discouraged | `execution_safety_warning=on` |

`operator_gated` is the explicit conservative posture marker, not a default, and expects trusted GitHub authors. Status, doctor, and setup/readiness surface `trust_mode=`, `execution_safety_mode=`, `doctor_posture`, and `execution_safety_warning` consistently.

## Fresh facts vs cached hydration

Cached pull-request hydration is informational and non-authoritative; live decisions use fresh GitHub review facts.

No configuration should treat cached pull-request hydration as authority for readiness, review-blocking, or merge decisions.

## Repo-owned local CI contract

The dashboard and doctor surface one of three states:

- No repo-owned local CI contract is configured.
- Repo-owned local CI candidate exists but localCiCommand is unset. This warning is advisory only.
- Repo-owned local CI contract is configured.

If a repo script candidate exists, codex-supervisor will not run it until localCiCommand is configured; it must preserve backward compatibility by not inventing one. When configured local CI fails, PR publication stays blocked.

## Release readiness gate

`releaseReadinessGate` is `advisory` by default or `block_release_publication`. It affects release publication only — never PR publication or merge readiness. Issue verification stays issue-authored guidance.

## Corrupted state recovery

A corrupted JSON state is not a normal empty-state bootstrap case. Use `doctor` and `status` to inspect, acknowledge, or reset it.

## Workspace restore precedence

When restoring a workspace, the supervisor prefers a local issue branch, then a remote issue branch, then falls back to `origin/<defaultBranch>` bootstrap as a fallback.

## Orphaned workspace cleanup

`cleanupOrphanedWorkspacesAfterHours` only marks eligibility; the explicit `prune-orphaned-workspaces` action does the cleanup, and even then it preserves a worktree that is `locked`, `recent`, or `unsafe_target`. An orphaned worktree is pruned only by that explicit operator action, separate from tracked done worktree cleanup.
