---
name: Kontra Overview record actions
description: Centralized Overview actions must account for rendered category IDs and asynchronous Transaction Record hydration
---

Overview record actions must map backend field namespaces to the UI's rendered category IDs (`transaction` → `terms`, `approval`/`approvals` → `legal`, and equivalent aliases), then wait briefly for the asynchronously hydrated Transaction Record panel before scrolling and expanding it.

**Why:** A button can receive a real desktop pointer event yet appear unresponsive when the handler searches for a category ID that does not exist or performs a single lookup before the panel mounts.

**How to apply:** Keep field-to-category resolution centralized in the Overview action handler, use a bounded mount-aware retry, and do not change button-specific hit-target styling to mask routing or hydration failures.