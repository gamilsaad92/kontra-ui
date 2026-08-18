---
name: Kontra demo performance
description: Performance boundaries for public demo deal rooms and the coordinator Overview.
---

Public demo rooms should render from a small local identity shell and hydrate their seeded API state afterward; the deal-room route should remain code-split from the general app entry.

**Why:** The production API is fast when warm, while the initial frontend bundle and waiting for all Overview requests create the dominant perceived delay.

**How to apply:** Keep first paint independent of the property request and let Overview data sources update independently. Avoid moving heavy deal-room or wallet dependencies back into the initial application bundle.