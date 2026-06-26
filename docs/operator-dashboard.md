# Operator Dashboard

How the steady-state operator surfaces present local CI posture, release readiness, and remediation routing.

## Local CI posture

The dashboard surfaces one of three repo-owned local CI states:

- No repo-owned local CI contract is configured.
- Repo-owned local CI candidate exists but localCiCommand is unset. This warning is advisory only.
- Repo-owned local CI contract is configured.

When configured local CI fails, PR publication stays blocked and ready-for-review promotion stays blocked.

## Remediation routing

- Issue details panel: fix the issue first when the blocker is issue-authored.
- Doctor panel: repair host/config/state next when the blocker is host- or config-level.

## Release readiness

`releaseReadinessGate` is advisory by default and can be set to `block_release_publication`. The release-readiness gate affects release publication only — never PR publication or merge readiness.

```text
doctor_release_readiness_gate posture=advisory
```
