# Vibe Coding Before / After

A concrete narrative for the quality layer codex-supervisor adds.

## Same Small Change

The same small change — add a quick filter to the issue journal viewer — is
delivered two ways below.

## Before: Unstructured Chat Session

An unstructured chat session edits files directly. There is no
execution-ready GitHub issue, no per-issue worktree, no issue journal, no
draft PR, no local verification, and no evidence timeline. The result is the
missing quality layer: changes land without durable history or a reviewable
trail.

## After: Supervised codex-supervisor Loop

The supervised loop starts from an execution-ready GitHub issue, runs in a
per-issue worktree, writes an issue journal, opens a draft PR, runs local
verification, and records an evidence timeline with durable history. See the
[Phase 16 dogfood PR walkthrough](./examples/phase-16-dogfood-pr-walkthrough.md)
for an annotated run.

## Quality Delta

The delta is the quality layer itself: execution-ready issue, per-issue
worktree, issue journal, draft PR, local verification, evidence timeline, and
durable history — none of which exist in the before case.

## Operator Boundary

codex-supervisor does not replace the human operator. It adds a quality layer
around operator decisions; the operator still owns trust, review, and merge
judgment.
