---
name: Kontra artifact build environment
description: Workspace-managed Vite builds require the artifact runtime variables even for production builds.
---

The Kontra UI artifact build requires both `PORT` and `BASE_PATH` to be set; a production build can use any supported port and the artifact's registered preview path.

**Why:** The shared Vite config validates these variables before loading, so a build without them fails before transforming application code.

**How to apply:** Run the workspace build with explicit values such as `PORT=4173 BASE_PATH=/kontra-ui pnpm --filter @workspace/kontra-ui run build`; do not treat the missing-variable error as an application failure.