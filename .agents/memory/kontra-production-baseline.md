---
name: Kontra accepted Production baseline
description: Accepted Production baseline for the backward-compatibility release.
---

The accepted Production baseline is GitHub deployment revision `e7749bf36823baf112ae3733ba2f7b8ae2d7ab2b`.

**Why:** Production was accepted as healthy after the backward-compatibility smoke review; the non-blocking authenticated participant download check does not justify further changes.

**How to apply:** Preserve the dashboard/state-resolution architecture and regression tests. Do not roll back or alter historical Production rooms for this issue.