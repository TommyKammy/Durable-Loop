# Codex Supervisor

Codex Supervisor turns vibe coding into issue-driven, test-backed, reviewable software delivery.

## What It Is

A quality layer for supervised GitHub PR delivery. It takes a change through the supervised quality loop: issue contract → local verification → reviewable PR → evidence timeline. Live decisions use fresh GitHub PR facts, and it holds a hard trust boundary — GitHub-authored text is untrusted execution input.

Published artifact contracts:

- [issue body contract](./docs/issue-body-contract.schema.json)
- [trust posture](./docs/trust-posture-config.schema.json)
- [operator actions](./docs/operator-actions.schema.json)
- [evidence timeline](./docs/evidence-timeline.schema.json)
- [automation boundary](./docs/codex-automation-connector-boundary.schema.json)

See the [Before / After narrative](./docs/vibe-coding-before-after.md), the [Supervised automation lane](./docs/supervised-automation-lane.md), and the [AI coding quality kit](./docs/quality-kit.md): compact primitive map and public package surface. It is docs-first and is not published as an npm package.

## Who It Is For

Solo operators running trusted, issue-driven delivery in a trusted repo.

## Quick Start

Follow the [Playground smoke run](./docs/playground-smoke-run.md):

```sh
npm install
npm run build
cp supervisor.config.example.json supervisor.config.playground.json
export CODEX_SUPERVISOR_CONFIG=<supervisor-config-path>
node dist/index.js help
node dist/index.js doctor --config "$CODEX_SUPERVISOR_CONFIG"
node dist/index.js status --config "$CODEX_SUPERVISOR_CONFIG" --why
node dist/index.js issue-lint <issue-number> --config "$CODEX_SUPERVISOR_CONFIG"
node dist/index.js run-once --config "$CODEX_SUPERVISOR_CONFIG" --dry-run
node dist/index.js run-once --config "$CODEX_SUPERVISOR_CONFIG"
```

Stop after one successful `run-once`.

Only run in a trusted repo with trusted GitHub authors. After a clean run-once, hand off to the loop:

```sh
node dist/index.js loop --config "$CODEX_SUPERVISOR_CONFIG"
```

Next: [Configuration guide](./docs/configuration.md), [Getting started](./docs/getting-started.md), [Issue metadata](./docs/issue-metadata.md), [Architecture](./docs/architecture.md).

## WebUI

`node dist/index.js web` opens an operator dashboard at `/setup`. A WebUI session is an operator surface, not a loop run mode.

## Trust boundary and safety

codex-supervisor holds a hard trust boundary: GitHub-authored issue bodies and review comments are untrusted. Live decisions use fresh GitHub PR facts. See the [trust mode and execution safety mode combinations](./docs/configuration.md#trust-mode-and-execution-safety-mode-combinations) and the [Codex app Automation boundary](./docs/automation.md).

A missing JSON state and a corrupted JSON state differ: a corrupted JSON state is not a durable recovery point and needs explicit acknowledgement or reset.

When restoring a workspace, the supervisor prefers a local issue branch, then a remote issue branch, then falls back to `origin/<defaultBranch>` bootstrap as a fallback. An orphaned workspace is preserved when `locked`, `recent`, or `unsafe_target`, and is pruned only by an explicit operator prune action, separate from tracked done worktree cleanup.

## Provider profiles

The active config is whichever file you pass with `--config`. Set `codexModelStrategy: "inherit"` to follow the host Codex CLI/App default model; use `fixed` only to ignore, override, or pin a model instead of the host default model.

```sh
node dist/index.js issue-lint <issue-number> --config supervisor.config.codex.json
node dist/index.js status --config supervisor.config.codex.json --why
node dist/index.js doctor --config supervisor.config.codex.json
```

Next.js starter:

```sh
node dist/index.js issue-lint <issue-number> --config supervisor.config.nextjs.json
```

Use an edited copy of `supervisor.config.nextjs.json`, not the shipped starter file. Replace its placeholders before running `issue-lint`, `doctor`, or `status`. See [Getting started](./docs/getting-started.md).

On macOS, use `./scripts/start-loop-tmux.sh` to host the loop in a managed `tmux` session, and stop it with `./scripts/stop-loop-tmux.sh`. `./scripts/install-launchd.sh` is not a supported macOS loop path.

## Docs Map

- [Getting started](./docs/getting-started.md)
- [AI agent handoff](./docs/agent-instructions.md)
- [Supervised automation lane](./docs/supervised-automation-lane.md)
- [Architecture](./docs/architecture.md)
- [Configuration guide](./docs/configuration.md)
- [Issue metadata](./docs/issue-metadata.md)
- [Self-contained demo scenario](./docs/examples/self-contained-demo-scenario.md)
- [Phase 16 dogfood PR walkthrough](./docs/examples/phase-16-dogfood-pr-walkthrough.md)
- [Public demo validation checklist](./docs/public-demo-validation-checklist.md)
- [Quality gate examples](./docs/examples/quality-gate-examples.md)
- [AI coding quality kit](./docs/quality-kit.md)
- [Quality kit package surfaces](./docs/quality-kit-package-surfaces.md)
- [Quality kit adoption checklist](./docs/quality-kit-adoption-checklist.md)
- [Release readiness checklist](./docs/validation-checklist.md)
- [Playground smoke run](./docs/playground-smoke-run.md)
