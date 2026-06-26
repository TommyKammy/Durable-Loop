# Operator Actions Template

Copy this into your repo to publish the operator action vocabulary you support.

- Each action names a `<next-operator-action>` from the published vocabulary.
- Operator actions never bypass executor safety gates or operator confirmations.
- Keep the vocabulary aligned with `docs/operator-actions.schema.json`.

```sh
node dist/index.js status --config <supervisor-config-path> --why
```
