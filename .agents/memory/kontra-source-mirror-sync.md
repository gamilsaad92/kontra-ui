---
name: Kontra source mirror sync
description: Repository behavior that mirrors the deployed UI source during commits
---

The Kontra repository has a pre-commit sync hook that copies `kontra-ui-clone/ui/src` into the root `ui/src` mirror. A commit can therefore stage the primary source change first and leave the mirrored change staged afterward.

**Why:** A navigation change initially pushed the primary source commit while the hook-created mirror update remained staged, leaving GitHub with temporarily divergent copies.

**How to apply:** After committing Kontra UI changes, inspect `git status` and `git diff --cached`; if the mirror contains the same intended change, commit and push the sync commit before reporting the work as fully pushed.