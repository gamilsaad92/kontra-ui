---
name: Kontra UI Jest harness
description: How to run coordinator logic tests in the legacy root UI package
---

The coordinator logic suite runs through the legacy `ui/` package, which is outside the root pnpm workspace. Its Jest setup needs the package-local jsdom environment and CSS mapper dependencies, plus a test-only Babel replacement for Vite's `import.meta`.

**Why:** The generic workspace package installer targets the pnpm workspace root and cannot add dependencies to this legacy package; Jest otherwise fails before collecting tests or parsing the Vite page.

**How to apply:** Use the existing `ui/package.json`/`ui/package-lock.json` with the Jest-29-compatible dependencies, keep the `import.meta` replacement gated to `NODE_ENV === 'test'`, and run the coordinator suite separately from unrelated legacy UI tests.