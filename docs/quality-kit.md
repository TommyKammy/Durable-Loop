# AI Coding Quality Kit

This is the public product overview of the AI coding quality kit: a compact map of the quality primitives and the public package surface.

The kit is docs-first and is not published as an npm package in this phase. External adopters should treat these artifacts as the stable, copyable quality-kit surface.

The primitives below each link to a canonical reference and a copyable schema.

## Issue Contract

The execution-ready issue contract. See [Issue metadata](./issue-metadata.md) and the [issue body contract](./issue-body-contract.schema.json).

## Local Verification Gate

The repo-owned pre-PR gate. See the [Configuration reference](./configuration.md) and the [Local review reference](./local-review.md).

## Prompt Safety Boundary

GitHub-authored text is untrusted context, not executor policy. See the [AI agent handoff](./agent-instructions.md) and the [trust posture](./trust-posture-config.schema.json).

## Evidence Timeline

The auditable, informational timeline. See the [evidence timeline](./evidence-timeline.schema.json).

## Operator Action

The published next-action vocabulary. See the [Operator actions](./operator-actions.schema.json) and the [Supervised automation lane](./supervised-automation-lane.md).

## Durable History Writeback

Durable project memory writeback. See the [Architecture](./architecture.md) and the [self-contained demo scenario](./examples/self-contained-demo-scenario.md).

More adoption surfaces:

- [quality primitive templates](./templates/quality-primitives/README.md)
- [Quality gate examples](./examples/quality-gate-examples.md)
- [Quality kit adoption checklist](./quality-kit-adoption-checklist.md)
- [Quality kit package surfaces](./quality-kit-package-surfaces.md)
- [KANAME bootstrap handoff](./kaname-bootstrap-handoff.md)
- [Phase 5 closeout evidence](./phase5-closeout-evidence.md)

## Public Package Surface

The smallest stable surface, per the Phase 18.1 package-surface comparison in [Quality kit package surfaces](./quality-kit-package-surfaces.md):

- docs/quality-kit.md
- .github/ISSUE_TEMPLATE/codex-execution-ready.md
- docs/issue-body-contract.schema.json
- docs/evidence-timeline.schema.json
- docs/operator-actions.schema.json
- docs/trust-posture-config.schema.json
- docs/supervised-automation-state-machine.schema.json
- docs/codex-automation-connector-boundary.schema.json

## Internal-Only Surfaces

These stay internal and are not part of the public surface:

- src/**/*.ts
- dist/
- .codex-supervisor/
- .local/
- WebUI
- KANAME

The quality kit does not publish a cloud service, does not publish a provider SDK, and does not expand executor authority.

## Schema Versioning and Compatibility

Each published schema carries a numeric version field and a compatibility note. Additive changes stay backward-compatible; breaking changes bump the version. The schemas do not claim runtime enforcement beyond the existing runtime.
