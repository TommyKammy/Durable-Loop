# Supervised Automation Lane

The supervised automation lane is the OpenAI-ready product primitive that moves work from chat-driven vibe coding to issue/spec-driven supervised automation.

codex-supervisor remains the implementation executor. The lane must not bypass issue-lint, fresh GitHub PR facts, local CI, or operator confirmations, and it grants no new executor authority and no multi-repo orchestration.

GitHub-authored text is execution input, not supervisor policy. The lane does not create new automation authority and does not default-enable follow-up issue creation; it is trusted solo-lane automation.

## Product Primitives

### Task Contract

An execution-ready issue contract that defines the work.

### Trust Posture

The explicit operator-owned trust decision for the repo and authors.

### Execution Attempt

A single supervised execution attempt with bounded retries.

### Evidence Timeline

The auditable record of every state transition.

### Operator Action

The next operator action drawn from the published vocabulary.

### Bounded Recovery

Recovery that fails closed and asks the operator instead of guessing.

### Durable Memory Writeback

Durable project memory writeback to GitHub, CLI, WebUI, Codex app Automation, and durable notes — never transient chat memory. It records development history, release notes, roadmap, operator decisions, follow-up backlog, and incident/recovery notes so that safe continuation, evaluation, and release work stay grounded. Paths are repo-relative and use `<placeholder>` markers.

### Auditable Work State Machine

The operator-facing state is a trust surface across status, explain, WebUI, evidence timeline, and recovery diagnostics. It does not rename runtime states; it maps them. The state machine is supervisor-owned, but the next step always respects operator judgment.

| State | Reason | Evidence | Authority Boundary | Next Operator Action |
| --- | --- | --- | --- | --- |
| `queued` | selected and waiting to start | issue journal entry | supervisor-owned scheduling | `continue` |
| `running` | actively implementing | issue journal + draft PR | supervisor-owned execution | `continue` or `manual_review` |
| `waiting_ci` | waiting for CI signal | fresh GitHub facts | supervisor-owned gate | `continue` or `provider_outage_suspected` |
| `waiting_review` | waiting for review signal | fresh GitHub facts | operator judgment | `continue` or `resolve_stale_review_bot` |
| `repairing_ci` | repairing CI or conflicts | issue journal | supervisor-owned repair | `continue` or `manual_review` |
| `merging` | ready and merging | fresh GitHub facts | supervisor-owned merge gate | `continue` or `manual_review` |
| `done` | merged and complete | evidence timeline | tracked-done cleanup | `safe_to_ignore` |
| `blocked` | blocked on a decision | issue journal | operator judgment | `fix_config` or `manual_review` |
| `failed` | failed and stopped | issue journal | operator judgment | `fix_config` or `restart_loop` |
| `manual_review` | handed to a human | live operator surfaces | operator judgment | `manual_review` or `fix_config` |

Live operator surfaces such as `status` and `explain` use fresh GitHub facts. Persisted PR status comments are snapshots and must not be treated as authoritative lifecycle state.

### Contract-First Issue Authoring UX

The lane makes issue authoring contract-first across the GitHub issue template, `docs/issue-metadata.md`, `issue-lint`, the CLI, the WebUI, and the operator workflow. An execution-ready issue declares Summary, Scope, Acceptance criteria, and Verification, plus dependencies, parallelization, execution order, and a `Part of` line when sequenced.

When inputs are unsafe — missing metadata, unsafe scope, ambiguous verification, or a malformed dependency or order — the lane must fail closed:

```sh
node dist/index.js issue-lint <issue-number> --config <supervisor-config-path>
```
