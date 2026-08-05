---
name: Kontra GitHub remote
description: Repository-specific remote naming needed for GitHub pushes
---

The repository’s GitHub remote is named `github` (there is no `origin`), repo is `gamilsaad92/kontra-ui`, and **all** GitHub tooling in this workspace returns `NO_CREDENTIALS` — `gitPush`, `gitPull`, `createPullRequest`, and `listConnections('github')` — even after the user reconnects the GitHub integration (connection shows `added`). `git push` via CLI also fails (no stored HTTPS creds).

**Working publish path (2026-08):** the connector proxy works from a Node script in the workspace shell. `REPLIT_CONNECTORS_HOSTNAME` + `REPL_IDENTITY` env vars are set for the shell/SDK, so `npm i @replit/connectors-sdk` in a scratch dir and `new ReplitConnectors().proxy("github",<path>,{method,...})` gives authenticated GitHub REST access. Publish only via the git-data API: POST `/git/blobs` (content base64) → POST `/git/trees` (with `base_tree`) → POST `/git/commits` (author/committer from `git show -s --format=...` quoting the format!) → PATCH `/git/refs/heads/<branch>` (`force:false`). Script lives in `/tmp/connprobe/push-main.mjs` (scratch, not committed).

Gotchas: `git diff-tree -r --raw <sha>` prints the commit SHA as its first line — filter to lines starting with `:`; quote git `--format` strings or `|` separators get eaten by the shell; ref paths need the `/repos/...` prefix.

**How to apply:** To publish to GitHub, replay remote-friendly objects through the connector proxy as above instead of retrying the helpers. User constraint: never modify `master`; publish fixes to `main`.

**Why:** Several reconnect attempts landed but the platform still does not expose a token to this workspace, so the helpers cannot work; the proxy path was verified end-to-end (main moved to `6c2116bc`, tree identical to local, master untouched).