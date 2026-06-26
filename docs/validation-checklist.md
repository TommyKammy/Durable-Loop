# Release Readiness Checklist

This is the maintained release-readiness artifact. It is an advisory checklist
and issue-authored verification guidance — it is not a repo-owned fail-closed
gate by itself.

## Readiness levels

### Minimum

- first-run setup is complete
- one-shot execution succeeds

### Recommended

- loop operation is stable
- review handling and merge convergence behave as expected
- WebUI and local CI are exercised

### Sufficient

- release gate criteria are met
- trust boundaries are documented and respected

## Checklist

- [ ] first-run setup verified
- [ ] one-shot execution verified
- [ ] loop operation verified
- [ ] review handling verified
- [ ] merge convergence verified
- [ ] WebUI verified
- [ ] local CI verified
- [ ] release gate verified
- [ ] trust boundaries verified
- [ ] release notes source is set: `releaseNotesSources` and
      `summarize-post-merge-audits` produce development-history updates

## Advisory boundary

This advisory checklist provides issue-authored verification guidance and is
not a repo-owned fail-closed gate by itself.

- `releaseReadinessGate: advisory` keeps readiness informational and must not block PR publication.
- `releaseReadinessGate: block_release_publication` and
  `doctor_release_readiness_gate` block release publication only.
- The release-readiness gate affects release publication only — never PR
  publication or merge readiness.

## Verification

```sh
node dist/index.js run-once --config <supervisor-config-path>
node dist/index.js loop --config <supervisor-config-path>
node dist/index.js web --config <supervisor-config-path>
npm run verify:supervisor-pre-pr
```
