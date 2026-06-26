# Quality Gate Examples

These scenarios are readable offline and do not require live GitHub credentials.

## Local CI

The repo-owned local CI gate runs before PR publication:

```sh
npm run build
```

## Path Hygiene

```sh
npm run verify:paths
npm run verify:subprocess-safety
```

## Review Readiness

Lint the issue contract before review:

```sh
node dist/index.js issue-lint <issue-number> --config <supervisor-config-path>
```

## Stale Review Bot Remediation Boundary

A SafeQuery-shaped metadata-only stale review bot is a metadata-only handled review state and can be remediated by an explicit operator action. A genuine unresolved provider-signal is different: it must stay unresolved until the provider signal is actually addressed.

## Evidence Timeline

```sh
node dist/index.js explain <issue-number> --timeline --config <supervisor-config-path>
```
