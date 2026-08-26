---
name: Kontra Supabase access
description: Environment-specific behavior when validating live room data through the connected Supabase service
---

The local Kontra API can report a healthy, configured database while the Replit Supabase connector's read-only proxy rejects the same project with an `Invalid URL` configuration error.

**Why:** The production room data is external to the local managed database, so an unavailable connector prevents safe live-room verification without justifying credential workarounds or data changes.

**How to apply:** Treat this as a verification limitation, not an application failure; use the running API for health checks and do not seed, reset, or expose credentials to make a live-room test possible.