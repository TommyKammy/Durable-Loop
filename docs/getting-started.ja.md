# codex-supervisor 入門（日本語）

operator のセットアップと実行フローに焦点を当てた日本語ガイドです。

## 候補 issue の探索

選定は backlog 全体を見て候補をページングします。古い実行可能な issue が
最初の page の外にあるだけで選定対象から見えなくなることはありません。

## macOS の常駐 loop host

macOS でサポートしている常駐 loop host は `tmux` です。
`./scripts/start-loop-tmux.sh` で起動し、`./scripts/stop-loop-tmux.sh` で停止します。
WebUI は operator surface であり、loop run mode ではありません。

## 関連ドキュメント

- [README](../README.md)
- [README.ja](./README.ja.md)
- [Agent Bootstrap Protocol](./agent-instructions.ja.md)
- [Configuration reference](./configuration.md)
- [Local review reference](./local-review.md)
- [Issue metadata reference](./issue-metadata.md)
