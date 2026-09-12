---
name: API test dependencies
description: Environment-specific limitation affecting direct API Jest execution
---

The root API checkout is not guaranteed to have its declared test/runtime dependencies installed; direct API Jest runs can fail before loading tests because `jest` or `pg` is missing.

**Why:** The production API source and the UI have separate dependency trees, and the configured preview workflow serves a different clone. Treat a missing binary/module as an environment limitation, not a product failure.

**How to apply:** Use syntax checks and focused pure-module tests through the installed UI Jest binary when they do not require API runtime dependencies; report the limitation instead of installing unrelated packages during feature work.