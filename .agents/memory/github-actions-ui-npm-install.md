---
name: GitHub Actions UI dependency installation
description: Repeated clean UI npm installs failed on the Actions runner while local frontend checks passed.
---

Clean `npm ci --prefix ui` runs on the GitHub Actions Node 22.23.4 / npm 10.9.9 runner repeatedly ended with `npm error Exit handler never called!`. The failure persisted with reduced audit/network work, foreground lifecycle output, and an isolated UI job. The API install succeeded, and the local staging-configured frontend build, asset scan, and focused UI tests passed using the workspace's existing dependencies.

**Why:** Repeating small install-flag variations did not change the failure, so it was treated as an unresolved runner/package-manager issue rather than a frontend build regression.

**How to apply:** Before restoring UI dependency installation to this CI workflow, diagnose the npm debug log or package lifecycle on a clean runner, or pin and verify a compatible npm toolchain. Until then, rely on the recorded local build/test verification and keep the Actions gate focused on API checks.
