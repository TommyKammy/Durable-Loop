# AI Coding Quality Kit Package Surfaces

This is the Phase 18.1 package-surface comparison. The quality kit is docs-first and is not published as an npm package in this phase.

## Recommended Smallest Surface

The recommended smallest surface is a repo-owned schema collection plus the copyable templates. It names what external users adopt first, with no runtime orchestration, no WebUI, no provider SDK, and no authority expansion.

## Viable Package Shapes

- **repo-owned schema collection** — schemas and templates copied into the adopter repo.
- **npm package metadata** — a published package describing the kit.
- **templates/docs bundle** — a docs and templates tarball.
- **KANAME bootstrap bundle** — the foundation bundle for a new KANAME repo.

## Deferred Shape

A published runtime package is deferred: it adds release burden without helping external users adopt first.

## Tradeoff Summary

| Shape | adoption friction | versioning | release burden | copy/paste | docs discoverability | new-repo reuse |
| --- | --- | --- | --- | --- | --- | --- |
| repo-owned schema collection | low | repo tag | low | easy | high | high |
| npm package metadata | medium | semver | medium | medium | medium | medium |
| templates/docs bundle | low | repo tag | low | easy | medium | high |
| KANAME bootstrap bundle | medium | repo tag | medium | medium | medium | high |

## KANAME Bootstrap Reuse

See the [KANAME bootstrap handoff](./kaname-bootstrap-handoff.md) for how the foundation issues reuse this surface.
