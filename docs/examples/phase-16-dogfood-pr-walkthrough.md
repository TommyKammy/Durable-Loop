# Phase 16 Dogfood PR Walkthrough

An annotated walkthrough of a real Phase 16 supervised run, published as a
sanitized equivalent. It links the [AI coding quality kit](../quality-kit.md).

## Provenance

This walkthrough is the sanitized equivalent of an internal Phase 16 dogfood PR.
All machine-local details are replaced with placeholders.

## Lifecycle Walkthrough

1. **issue-lint** confirms the issue contract is execution-ready:

   ```sh
   node dist/index.js issue-lint <issue-number> --config <supervisor-config-path>
   ```

2. The run creates an issue journal and opens a draft PR.
3. **local verification** runs the repo-owned gate before publication.
4. A review provider posts findings; the operator action vocabulary drives the
   next step.
5. The evidence timeline records every transition.

## Artifact Contracts

- Issue metadata: `docs/issue-metadata.md`
- Evidence timeline: `docs/evidence-timeline.schema.json`
- Operator actions: `docs/operator-actions.schema.json`

These annotate the draft PR, issue journal, local verification, review provider,
operator action, and evidence timeline artifacts produced during the run.

## Sanitization Boundary

Every path is a placeholder; no machine-local paths appear. The sanitized
equivalent preserves structure without leaking workstation details.

## Read Offline

This walkthrough is readable offline and requires no live GitHub credentials.
