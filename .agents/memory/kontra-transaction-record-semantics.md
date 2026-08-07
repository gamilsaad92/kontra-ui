---
name: Kontra Transaction Record semantics
description: Durable rules for canonical values, workflow requirements, suggestions, and dependent Transaction Record fields.
---

The Transaction Record is an operational coordination layer, not a legal or regulatory determination system. A field marked workflow-required means the workspace workflow configured it as necessary; it must not be presented as legally, regulatorily, or contractually required.

**Why:** users need to distinguish Kontra's workflow checklist from external obligations, while AI-generated transaction-specific fields should remain suggestions until a pack rule or coordinator action promotes them.

**How to apply:** schema fields should carry separate workflow-required, summary-priority, and suggested/expected semantics. Repeated concepts should use one canonical key with display aliases, and extraction/manual entry must normalize aliases before persistence. Dependency rules should make downstream fields non-applicable when a confirmed prerequisite is N/A rather than leaving them outstanding. Summary completeness is factual record completeness—not deal health—and should count extracted, confirmed, manually entered, and setup-seeded values separately while excluding N/A items from the denominator.