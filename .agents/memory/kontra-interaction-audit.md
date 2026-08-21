---
name: Kontra interaction audit
description: Visible interactive affordances must either complete a local/demo action or clearly explain unavailable functionality
---

A control that looks actionable must produce a visible state change, navigation, or explicit availability message. Demo-only actions can update local state, while unavailable account areas should open a clear “not available in the current demo” message rather than silently emitting haptics.

**Why:** Broad interaction audits found that empty handlers, misleading chevrons, and simulated content routing make otherwise healthy screens feel broken even when pointer events work.

**How to apply:** Exercise controls through their rendered destination/state, not only event delivery; treat no-op handlers and static placeholder data behind selectable controls as defects unless the UI clearly labels them as unavailable.