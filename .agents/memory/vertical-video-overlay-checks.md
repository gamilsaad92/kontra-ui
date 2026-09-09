---
name: Vertical video overlay checks
description: Reusable quality rule for social videos assembled from UI screenshots and generated text cards
---

Generated vertical videos can look technically valid while title and callout overlays are clipped at the right edge. Always inspect representative keyframes from the opening, any generated annotation, the main interaction, and the ending before presenting the asset.

**Why:** FFmpeg drawtext does not automatically constrain or wrap text to the intended visual width, especially after scaling or zoompan filters.

**How to apply:** Keep generated copy comfortably inside the 720px canvas, then extract and visually inspect keyframes after the final concat/render—not just the individual overlay source.