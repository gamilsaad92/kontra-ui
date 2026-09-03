---
name: Node package firewall patches
description: Replit npm installs can reject a pinned vulnerable direct dependency even when the application code is valid
---

When the package firewall blocks a direct dependency tarball during `npm ci`, update that dependency to the latest compatible safe patch release and regenerate or align the lockfile rather than bypassing the firewall.

**Why:** The API preview cannot boot after its nested `node_modules` is cleared if the lockfile still points at a blocked vulnerable tarball.

**How to apply:** Keep the root API mirror and `kontra-ui-clone` API mirror manifests and lockfiles identical, then reinstall and restart the workflow before declaring the runtime healthy.