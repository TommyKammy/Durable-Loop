# Playground Smoke Run

A five-minute, sandbox-only smoke run for first-time operators.

## Posture

This guide is sandbox-only. It assumes a trusted repo with trusted GitHub authors and is not a production posture. Do not reuse the playground config for production: a production posture requires explicit trust and safety decisions.

Set the config path once:

```sh
export CODEX_SUPERVISOR_CONFIG=<supervisor-config-path>
```

## Lint the sample issue

```sh
node dist/index.js issue-lint <issue-number> --config <supervisor-config-path>
```

## Sample issue body

<!-- playground-smoke-sample-issue:start -->
```md
## Summary
Add a quick filter to the issue journal viewer so operators can narrow entries by run state.

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
<!-- playground-smoke-sample-issue:end -->
