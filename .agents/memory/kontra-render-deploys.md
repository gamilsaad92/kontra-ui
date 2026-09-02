---
name: Kontra Render deploy diagnosis
description: How to distinguish Render build failures from promote/provisioning failures for the production API service
---

Render deployment status is independent of Replit's deployment callbacks. A Render `update_failed` result can occur after dependency installation and build upload have succeeded, while the previous revision continues serving traffic.

**Why:** The production API's failed update showed a successful `npm ci` and build upload, then failed during the Render handoff before the replacement instance started; the existing instance remained healthy.

**How to apply:** Query Render's `/v1/logs` with the service resource and owner ID. If logs end at `Deploying...`/an indeterminate failure but show no application crash, verify the live health endpoint and treat it as a Render retry/provisioning issue rather than changing application code.

## Git tree completeness
Render's configured `rootDir` must exist in the checked-out GitHub commit, along with every repository-root runtime directory referenced by relative imports. A locally complete checkout can hide missing directories when the remote branch was created from a partial tree.

**Why:** A remote repair that restored only the Vercel `ui/` tree let Render fail first on missing `api/`, then on root-level `ai/` after `api/` was restored.

**How to apply:** Before retrying Render, recursively verify the live GitHub tree for `api/`, `shared/`, `ai/`, and required API entrypoints—not just the local filesystem. Keep `rootDir` aligned with the service's actual deployment configuration.