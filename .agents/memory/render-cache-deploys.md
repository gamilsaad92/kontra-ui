---
name: Render cache rebuilds
description: Diagnoses zero-output Node build failures after unusually large Render cache restores.
---

When a Render Node build fails immediately after restoring an unusually large cache and emits no package-manager error, retry the exact commit once with the Render build cache cleared before changing application code.

**Why:** A clean-cache rebuild can restore normal dependency installation when the failure is caused by stale or corrupted cached artifacts rather than the repository.

**How to apply:** Confirm the repository lockfile/build locally, inspect the Render build log, and use a single clear-cache rebuild for the same commit if the log shows the zero-output post-cache pattern.