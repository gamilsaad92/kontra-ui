---
name: Kontra GitHub connector writes
description: Environment-specific behavior when publishing the Kontra production source through the installed GitHub connection
---

GitHub repository reads work through the installed connection, but Git Data tree/blob writes and Contents API writes can be rejected by the connection's Cloudflare layer. Small GraphQL `createCommitOnBranch` mutations are the supported fallback, with bounded batches and a current `expectedHeadOid`.

**Why:** A source-tree restoration encountered repeated Cloudflare 403 responses on Git Data and Contents writes, while small GraphQL commit mutations succeeded intermittently.

**How to apply:** When publishing a large Kontra source restoration, verify the branch head before each batch, use small GraphQL additions, space mutations if the write filter activates, and never claim the remote tree is complete without a recursive path audit.

GraphQL `Blob.text` can be truncated for large source files even when the blob's `byteSize` is available. Never use a truncated blob read as the basis for a replacement commit; publish complete local contents and compare remote byte sizes after the commit.

**Why:** A successful GraphQL commit can still produce a syntactically incomplete file if the source was reconstructed from the connector's truncated text response.

**How to apply:** Check `isTruncated` and `byteSize`, prefer complete local file contents for additions, and run syntax checks plus remote byte-size verification before considering the publish complete.

When local `main` has diverged from the current GitHub `main`, base the GraphQL `createCommitOnBranch` mutation on the live head and publish only the intended file set; do not force-push the local history. The mutation requires `expectedHeadOid` at the input top level.

**Why:** The local Replit checkout can be based on a gitsafe snapshot while the connected GitHub branch has newer unrelated commits. Remote-based file edits preserve those changes and still publish the completed work.

**How to apply:** Resolve the current remote head through the GitHub connection, compare intended files against it, submit only address/content substitutions against that head, and verify the resulting commit and stale-reference scan.