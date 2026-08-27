---
name: Kontra source mirror sync
description: Repository behavior that mirrors the deployed UI source during commits
---

The Kontra repository has mirrored deployed trees: UI source is copied from `kontra-ui-clone/ui/src` into root `ui/src`, while Render's API service runs the root `api/` tree and may require approved API fixture changes to be mirrored from `kontra-ui-clone/api/`.

**Why:** A production API deployment can be live on the intended commit while still serving stale behavior if the approved API change exists only in the clone tree.

**How to apply:** Before deployment, compare changed runtime files against both trees; after committing, inspect `git status` and `git diff --cached`, then deploy the root API mirror and primary UI source together when both are involved. If root production code is intentionally ahead of the clone, the pre-commit sync can erase it; review or bypass that sync rather than accepting a large deletion diff. GitHub publishing must use the configured connector; the workspace may not have the connector SDK installed even when the connection itself is available.