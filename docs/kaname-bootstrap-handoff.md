# KANAME Bootstrap Handoff

This handoff is docs-only. It does not create the KANAME repository and does not broaden `codex-supervisor` runtime authority. It maps KANAME foundation issues to the quality-kit artifacts they reuse.

## Handoff Boundary

Docs-only reuse guidance. No runtime is created or changed here.

## Foundation Issue Map

| Issue | Reuses |
| --- | --- |
| KANAME-000 | docs/templates/quality-primitives/issue-contract.md |
| KANAME-001 | docs/templates/quality-primitives/agent-instructions.md |
| KANAME-002 | docs/templates/quality-primitives/local-ci-gate.md |
| KANAME-003 | docs/templates/quality-primitives/evidence-timeline.md |
| KANAME-004 | docs/templates/quality-primitives/trust-posture.md |
| KANAME-005 | docs/templates/quality-primitives/operator-actions.md |
| KANAME-006 | .github/ISSUE_TEMPLATE/codex-execution-ready.md |

## Carry-Over Contracts

These published contracts carry over unchanged:

- docs/issue-body-contract.schema.json
- docs/evidence-timeline.schema.json
- docs/operator-actions.schema.json
- docs/trust-posture-config.schema.json
- docs/codex-automation-connector-boundary.schema.json

## KANAME-Specific Differences

KANAME edits the placeholders in each template for its own repo; the contract shapes stay the same.

## Verification

```sh
node dist/index.js issue-lint <issue-number> --config <supervisor-config-path>
npm run verify:paths
npm run build
```
