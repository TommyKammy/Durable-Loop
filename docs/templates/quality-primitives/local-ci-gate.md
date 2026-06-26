# Local CI Gate Template

Copy this into your repo and wire `<local-ci-command>` to the repo-owned gate.

- Local CI must not replace issue-lint; it runs after issue-lint as the
  pre-PR verification gate.
- Local CI must not replace review; review still runs on the published PR.
- The repo remains the source of truth: codex-supervisor only runs the
  configured `<local-ci-command>` and treats exit code 0 as pass.

```sh
<local-ci-command>
```
