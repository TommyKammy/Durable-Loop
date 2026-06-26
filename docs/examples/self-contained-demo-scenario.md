# Self-contained Demo Scenario

An offline, self-contained demo that publishes the expected quality artifacts:
issue journal, draft PR, local verification, evidence timeline, review, and
merge. It links the [AI coding quality kit](../quality-kit.md) map.

Set the config path once:

```sh
export CODEX_SUPERVISOR_CONFIG=<supervisor-config-path>
```

## Demo issue body

Lint the demo issue before running:

```sh
node dist/index.js issue-lint <issue-number> --config <supervisor-config-path>
```

<!-- self-contained-demo-issue:start -->
```md
## Summary
Add an issue journal quick filter so operators can narrow journal entries by run state.

## Scope
- Only touch the issue journal rendering layer; keep the persisted journal schema unchanged.
- Avoid changing unrelated supervisor state-machine logic.

## Acceptance criteria
- Operators can filter issue journal entries by run state from the viewer.
- The new filter is covered by an automated test.

## Verification
- `npm run build`
- `npx tsx --test src/issue-journal-quick-filter.test.ts`

Depends on: none
Parallelizable: No

## Execution order
1 of 1
```
<!-- self-contained-demo-issue:end -->

## Expected local verification

Local verification runs `npm run build` and the named test target and must exit
zero before the draft PR is published.

## Expected PR outcome

The run opens a draft PR, records the issue journal, and moves through review to
merge once the gates pass.

## Evidence timeline references

The evidence timeline records each state transition with its reason and the
operator action vocabulary, so the review and merge path stays auditable.
