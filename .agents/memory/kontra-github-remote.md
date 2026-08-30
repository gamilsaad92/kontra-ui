---
name: Kontra GitHub remote
description: Repository-specific remote naming needed for GitHub pushes
---

The repository’s GitHub remote is named `github` (there is also a duplicate `origin`), repo is `gamilsaad92/kontra-ui`. The normal Git helpers and CLI HTTPS push may fail with missing credentials even when the GitHub connection is healthy; check `listConnections('github')` before retrying.

**Working publish path (2026-08):** the connector proxy works from a Node script in the workspace shell. `REPLIT_CONNECTORS_HOSTNAME` + `REPL_IDENTITY` env vars are set for the shell/SDK, so `npm i @replit/connectors-sdk` in a scratch dir and `new ReplitConnectors().proxy("github",<path>,{method,...})` gives authenticated GitHub REST access. Publish only via the git-data API: POST `/git/blobs` (content base64) → POST `/git/trees` (with `base_tree`) → POST `/git/commits` (author/committer from `git show -s --format=...` quoting the format!) → PATCH `/git/refs/heads/<branch>` (`force:false`). Script lives in `/tmp/connprobe/push-main.mjs` (scratch, not committed).

Gotchas: `git diff-tree -r --raw <sha>` prints the commit SHA as its first line — filter to lines starting with `:`; quote git `--format` strings or `|` separators get eaten by the shell; ref paths need the `/repos/...` prefix.

**How to apply:** To publish to GitHub, replay remote-friendly objects through the connector proxy as above instead of retrying the helpers. User constraint: never modify `master`; publish fixes to `main`.

**Why:** The connector proxy is the reliable fallback when the workspace Git credential helper cannot authenticate. The proxy path preserves the GitHub tree and can update `main` without touching `master`.

**Remote verification:** The local `github/main` tracking ref can lag the actual GitHub `main` when another publish path advances the branch. Verify the live ref through the connector before pushing; preserve any remote commits instead of trusting the stale local ref.

**Why:** A direct push based on the stale tracking ref risks overwriting remote deployment work even when the local worktree is clean.

**How to apply:** Read `/repos/gamilsaad92/kontra-ui/git/ref/heads/main` first, compare its commit to local ancestry, and publish on top of the live SHA.

**Connector commit identity:** A commit created through the GitHub connector can have a different SHA from the equivalent local commit (the connector chooses its own author/committer metadata). Treat the live GitHub SHA as authoritative; if it already contains the local baseline, create the new tree as a child of that live SHA rather than attempting to push the stale local parent.

**Why:** The workspace commit and the previously published baseline had identical content but different SHAs, so a strict local-parent comparison would reject a safe fast-forward.

**How to apply:** Compare the live ref before publishing, use the live commit as both `base_tree` source and parent, then keep the local worktree clean even if its branch ref cannot be advanced to the connector-created object.

## Vercel deployment aliases

Vercel can successfully deploy a new GitHub `main` commit while leaving an older deployment-specific `*.vercel.app` URL pointed at the previous build. A successful Vercel status on the commit includes the current deployment URL; verify that URL directly instead of assuming an older preview/deployment alias moved.

**Why:** The production commit deployed successfully, but the previously shared deployment URL continued serving an older cached bundle with the old room labels.

**How to apply:** After publishing through the GitHub connector, read the Vercel deployment status URL from the commit/deployment metadata and test that hostname. Treat an old deployment-specific hostname as immutable history, not the canonical production alias.

## Connector write-call stability

For GitHub git-data publishes, the connector proxy is more reliable when blob uploads, tree creation, commit creation, and ref advancement are separate calls. A combined durable call can fail at the wrapper boundary with `null does not match type Pattern` even though the individual API operations succeed.

**Why:** A release publish encountered this wrapper failure twice; the same authenticated calls completed successfully when split into endpoint-sized operations, with the live ref checked before the tree and before the ref update.

**How to apply:** Keep each GitHub write step in its own proxy call, use a live SHA as `base_tree` and commit parent, and update the branch with `force: false`.

## Durable runtime note

The durable code-execution file-transfer budget can be exceeded when bulk-reading a multi-file change set. For connector publishes, read workspace files inside the small impure publish routine instead of loading every file through durable `readFile` first.

**Why:** A publish preparation attempt exceeded the sandbox’s combined file-operation budget even though the individual source files were valid.

**How to apply:** Keep the connector API calls endpoint-sized and keep large file reads inside the impure routine that uploads each blob.

## Vercel webhook lag

GitHub `main` can advance successfully while the Kontra production alias continues serving an older hashed bundle; verify the alias contents after each frontend publish.

**Why:** The Vercel connection may report no usable client, and a GitHub push alone is not proof that the live alias rebuilt.

**How to apply:** Do not call a frontend fix deployed until the live alias references a new room chunk containing the change; repair Vercel deployment access through the workspace connection rather than asking for a token.