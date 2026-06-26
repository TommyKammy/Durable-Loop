# Public Demo Validation Checklist

Guards the publishable demo surfaces so they stay accurate and path-safe.

## Checklist

- [ ] README positioning still matches the product narrative
- [ ] [self-contained demo scenario](./examples/self-contained-demo-scenario.md)
      runs offline
- [ ] [annotated PR walkthrough](./examples/phase-16-dogfood-pr-walkthrough.md)
      reflects the supervised lifecycle
- [ ] path hygiene passes (`npm run verify:paths`)
- [ ] schema links resolve:
  - [issue body contract](./issue-body-contract.schema.json)
  - [evidence timeline](./evidence-timeline.schema.json)
  - [operator actions](./operator-actions.schema.json)

## Drift Checks

- `docs/examples/self-contained-demo-scenario.md` issue body is still
  execution-ready.
- `docs/examples/phase-16-dogfood-pr-walkthrough.md` annotations still match the
  artifact contracts.
- `docs/issue-body-contract.schema.json`, `docs/evidence-timeline.schema.json`,
  and `docs/operator-actions.schema.json` versions are unchanged or bumped
  intentionally.

## Refresh Readiness Note

When a demo surface changes, re-run the lint and build before publishing:

```sh
export CODEX_SUPERVISOR_CONFIG=<supervisor-config-path>
node dist/index.js issue-lint <issue-number> --config <supervisor-config-path>
```

## Verification

```sh
npm run verify:paths
npm run build
```
