# Issue Contract Template

Copy this into a new execution-ready issue and replace every `<placeholder>`.

## Summary

<one or two sentences describing the smallest valuable change>

## Scope

- <only touch these files/areas; keep everything else unchanged>
- <call out what to avoid or leave out of scope>

## Acceptance criteria

- <observable outcome 1>
- <observable outcome 2>

## Verification

- `<command that proves the change, e.g. npm run build>`
- `<concrete test target, e.g. src/<area>.test.ts>`

Depends on: none
Parallelizable: No

## Execution order

1 of 1

Lint it before running:

```sh
node dist/index.js issue-lint <issue-number> --config <supervisor-config-path>
```
