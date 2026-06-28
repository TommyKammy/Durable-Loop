# Getting Started with codex-supervisor

Operator-focused setup and first-run flow. For the product overview, see the [README](../README.md).

## Before you start

You need a trusted repo with trusted authors. Autonomous execution is not safe without that trust: GitHub-authored issue bodies and review comments are untrusted execution input.

Run the lightweight pre-PR path-hygiene check, which is independent from `build` and `test`:

```sh
npm run verify:paths
```

Current fail-closed implementation rule: stop and escalate when provenance, scope, auth context, or trust-boundary signals are missing, malformed, or only partially trusted.

Candidate discovery pages through matching open issues across the matching open backlog, so older runnable issues remain discoverable even when they are not on the first page.

## Choose the operating mode

Pick `run-once`, `loop`, or `web`.

On macOS, the supported background loop host is `tmux`. Start it with `./scripts/start-loop-tmux.sh` and stop it with `./scripts/stop-loop-tmux.sh`.

`./scripts/install-launchd.sh` now fails closed and is not a supported macOS loop path. If you want a launcher-managed background loop on Linux, use `./scripts/install-systemd.sh`. For a launcher-managed WebUI on macOS, use `./scripts/install-launchd-web.sh`. A WebUI session is an operator surface, not a loop run mode.

## Prepare the supervisor config

The active config is whichever file you pass with `--config`. Shipped profiles include `supervisor.config.codex.json`, `supervisor.config.coderabbit.json`, and `supervisor.config.copilot.json`.

Run `issue-lint`, `status`, and `doctor` against an explicit profile, for example `node dist/index.js issue-lint <issue-number> --config supervisor.config.codex.json`, `node dist/index.js status --config supervisor.config.codex.json --why`, and `node dist/index.js doctor --config supervisor.config.codex.json`.

Set `codexModelStrategy: "inherit"` (recommended) to follow the host Codex CLI/App default model. Use `fixed` only when you must ignore, override, or pin a specific model instead of the host default model.

Setup readiness is a typed setup/readiness contract; doctor is not that setup/readiness contract. It reports each field as `configured | missing | invalid` and exposes editable setup inputs without inferring from labels, with typed remediation guidance. It states what is configured, what is missing, what is invalid, and what still blocks first-run operation:

```ts
kind: "setup_readiness"
type SetupReadinessFieldValueType =
  | "directory_path"
  | "repo_slug"
  | "git_ref"
  | "file_path"
  | "executable_path"
  | "text"
  | "review_provider";
type SetupReadinessRemediationKind =
  | "edit_config"
  | "configure_review_provider"
  | "authenticate_github"
  | "verify_codex_cli"
  | "repair_worktree_layout";
type SetupReadinessFieldKey =
  | "repoPath"
  | "repoSlug"
  | "defaultBranch"
  | "workspaceRoot"
  | "stateFile"
  | "executorBinary"
  | "branchPrefix"
  | "localCiCommand"
  | "reviewProvider";
interface SetupReadinessField {
  valueType: SetupReadinessFieldValueType;
  kind: SetupReadinessRemediationKind;
}
localCiContract?: LocalCiContractSummary
releaseReadinessGate: advisory
releaseReadinessGate: block_release_publication
```

The setup flow and WebUI should surface whether the repo-owned local CI contract is configured. At minimum, set these first-run fields before the first run: `trustMode` and `executionSafetyMode`. Setup readiness stays `ready: false` until these required first-run blockers are cleared with explicit trust posture decisions.

### Explicit trust posture setup

Explicit trust posture setup is a product primitive. Trust posture setup is a product primitive that captures repo trust, author trust, sandbox posture, local CI posture, review provider posture, auto-merge posture, and follow-up issue posture.

Each is an operator-owned decision, never an automation-owned decision. Dangerous or authority-expanding choices stay behind explicit opt-ins. Local CI and review-provider posture contribute to trust without becoming hidden authority — this is trusted solo-lane automation surfaced consistently across setup/readiness, `doctor`, `status`, and WebUI.

See the [trust mode and execution safety mode combinations](./configuration.md#trust-mode-and-execution-safety-mode-combinations).

The issue-level `## Verification` is issue-authored guidance and is not a repo-owned fail-closed gate by itself. The repo-owned local CI contract is the pre-PR gate: set `ci:local` / `verify:pre-pr` as the entrypoint. The repo remains the source of truth; codex-supervisor only runs the configured entrypoint and treats exit code 0 as pass and any non-zero exit code as fail. It does not infer or reconstruct workflow logic from GitHub Actions YAML.

Apply Ruff or similar static-analysis checks for `tests/` or `scripts/`, and when you must suppress a finding use an inline suppression with the exact rule code and a short rationale, for example `# noqa: S106 - dummy fixture credential` or `# noqa: S104 - test fixture requires wildcard bind`.

If no local CI contract is configured, the warning is advisory. When configured local CI fails, PR publication stays blocked and ready-for-review promotion stays blocked; status and doctor wording should name the active repo-owned gate.

## Write execution-ready issues

Author issues from the [Issue metadata reference](./issue-metadata.md). The issue-level `## Verification` is issue-authored guidance, not a repo gate.

## First-run command flow

```sh
node dist/index.js help
node dist/index.js web --config <supervisor-config-path>      # GET /api/setup-readiness
node dist/index.js doctor --config <supervisor-config-path>
node dist/index.js status --config <supervisor-config-path> --why
node dist/index.js issue-lint <issue-number> --config <supervisor-config-path>
node dist/index.js run-once --config <supervisor-config-path> --dry-run
node dist/index.js run-once --config <supervisor-config-path>
./scripts/start-loop-tmux.sh
```

Setup readiness prints `ready: false` and `blockers: [...]` until cleared. Doctor prints lines such as `doctor_check name=github_auth status=fail`. Status prints `current_issue=`, `missing_required=`, and `metadata_errors=` and supports `dry-run`.

The operator action vocabulary appears as `operator_action action=fix_config`, `operator_action action=restart_loop`, `loop_runtime_blocker`, `loop_runtime state=running`, `operator_action action=provider_outage_suspected`, `operator_action action=resolve_stale_review_bot`, `operator_action action=manual_review`, `operator_action action=continue`, `doctor_operator_action action=fix_config`, `operator_action action=adopt_local_ci`, `doctor_operator_action action=adopt_local_ci`, `doctor_operator_action action=safe_to_ignore`, and `doctor_release_readiness_gate posture=`.

## Move from run-once to loop

For the effective orphan cleanup policy, read `doctor`: `doctor_orphan_policy mode=explicit_only background_prune=false operator_prune=true preserved=locked,recent,unsafe_target`.

When restoring a workspace, the supervisor prefers a local issue branch, then a remote issue branch, then falls back to `origin/<defaultBranch>` bootstrap as a fallback. An orphaned workspace is preserved when `locked`, `recent`, or `unsafe_target`, and is pruned only by an explicit operator prune action, separate from tracked done worktree cleanup.

## Common operator decisions

Route the fix to the right surface: fix the GitHub issue body when the blocker is issue-authored, fix GitHub auth on the host when auth fails, and fix the supervisor config rather than the issue body when the config is wrong.

The repo-owned local CI states are: No repo-owned local CI contract is configured. Repo-owned local CI candidate exists but localCiCommand is unset. This warning is advisory only. Repo-owned local CI contract is configured. When configured local CI fails, PR publication stays blocked.

`releaseReadinessGate` is `advisory` by default or `block_release_publication`, affecting release publication only — never PR publication or merge readiness.

A missing JSON state and a corrupted JSON state are different: use `doctor` and `status`, and a corrupted JSON state needs explicit acknowledgement or reset.

## Common mistakes

Always pass an explicit `--config <supervisor-config-path>`; never hand-edit a config that setup readiness reports as `invalid`.

## Related docs

- [README](../README.md)
- [Agent Bootstrap Protocol](./agent-instructions.md)
- [Configuration reference](./configuration.md)
- [Local review reference](./local-review.md)
- [Issue metadata reference](./issue-metadata.md)
- [Release readiness checklist](./validation-checklist.md)
- [Playground smoke run](./playground-smoke-run.md)
