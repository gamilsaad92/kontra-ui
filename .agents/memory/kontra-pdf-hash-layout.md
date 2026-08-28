---
name: Kontra PDF hash layout
description: Deterministic artifact-hash rendering requirements for Kontra PDF documents
---

PDF artifact hash verification depends on more than replacing the displayed placeholder bytes. The placeholder and final hexadecimal hash must occupy the same fixed-width, line-stable layout; proportional-font metrics can change PDF text-position instructions and make the normalized hash drift.

**Why:** The same-length placeholder and hexadecimal hash have different glyph widths in proportional fonts, so a two-pass PDF can fail its own artifact-hash verification even when the visible hash is correct.

**How to apply:** Keep technical hashes in fixed-width table cells (with explicit line breaks/chunking when needed), preserve the existing placeholder normalization, and regression-test both the displayed hash and final verification.