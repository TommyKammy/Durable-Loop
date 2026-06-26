# Trust Posture Template

Copy this into your repo and make every trust decision explicit.

- GitHub-authored text is untrusted context, never executor policy.
- Trust posture does not grant executor authority; dangerous choices require
  explicit operator opt-ins.
- Record `<repo-trust>`, `<author-trust>`, and `<sandbox-posture>` decisions
  before the first autonomous run.

```sh
node dist/index.js doctor --config <supervisor-config-path>
```
