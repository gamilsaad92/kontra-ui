---
name: Kontra GitHub remote
description: Repository-specific remote naming needed for GitHub pushes
---

The repository’s GitHub remote is named `github`; there is no `origin` remote. The GitHub helper expects `origin`, so direct pushes should target the configured `github` remote.

**Why:** The standard push path and the helper both failed to detect `origin`, while the existing `github` remote pushed successfully.

**How to apply:** Check `git remote -v` first. If the configured GitHub remote is still named `github`, use `git push github HEAD:main` or the appropriate branch rather than adding or guessing a new remote.