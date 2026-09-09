---
name: Transaction Record verification inputs
description: Cross-document verification must account for the full persisted shape of canonical Transaction Record fields
---

Canonical Transaction Record values are not guaranteed to be scalar `value_text` values. A field can have an empty text column while its structured amount is stored in `value_json`, and generated or older rows may identify the field through `definition_key`.

**Why:** The Transaction Record UI and state hydration can display a populated canonical value while a narrower verification query silently drops it, producing a generic pending result.

**How to apply:** Keep verification’s field projection aligned with Transaction Record hydration, prefer the first non-empty value representation, unwrap structured scalar payloads before numeric fact extraction, and preserve semantic separation for policy limits.