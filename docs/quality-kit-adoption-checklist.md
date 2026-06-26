# Quality Kit Adoption Checklist

An incremental adoption path that starts with one repository and one safe issue. It does not require enabling broader automation and does not expand executor authority. Every step is an explicit operator decision with a clear rollback.

## Adoption Boundary

Adopt one primitive at a time. See the [AI Coding Quality Kit](./quality-kit.md) and the [quality primitive templates](./templates/quality-primitives/README.md).

## Prerequisites

A trusted repo and a prepared config, plus the [codex issue template](../.github/ISSUE_TEMPLATE/codex-execution-ready.md).

```sh
node dist/index.js doctor --config <supervisor-config-path>
```

## First Safe Issue

Author one safe issue from the [Issue metadata](./issue-metadata.md) contract.

```sh
node dist/index.js issue-lint <issue-number> --config <supervisor-config-path>
```

## Local CI Expectations

See the [Configuration reference](./configuration.md) and [Quality gate examples](./examples/quality-gate-examples.md).

```sh
npm run verify:paths
npm run build
```

## Review Provider Expectations

Pick one review provider and keep its posture explicit.

## Trust Posture

Record trust posture as an explicit operator decision before the first run.

## Operator Decision Points

Each gate resolves to an explicit operator decision, never hidden authority.

## Rollback

Every step has a clean rollback: stop the loop and the repo is unchanged.

## Durable History Writeback

Record durable history after each safe issue.

## Verification

- [TypeScript and Node starter profile](./examples/typescript-node.md)
- [Next.js starter profile](./examples/nextjs.md)
- [Python and CLI starter profile](./examples/python-cli.md)
