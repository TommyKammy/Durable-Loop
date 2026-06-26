# Evidence Timeline Template

Copy this into your repo to describe the per-issue evidence timeline you expect.

- Each entry records `<state>`, `<reason>`, `<evidence>`, and `<next-operator-action>`.
- The timeline is informational and non-authoritative for live decisions.
- Live operator surfaces such as `status` and `explain` use fresh GitHub facts.

Inspect it offline with:

```sh
node dist/index.js explain <issue-number> --timeline --config <supervisor-config-path>
```
