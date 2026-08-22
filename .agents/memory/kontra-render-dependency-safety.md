---
name: Kontra Render dependency safety
description: Dependency constraint discovered while diagnosing Render builds
---

Keep `@google-cloud/dialogflow` on a maintained release line that resolves to protobuf 7.x; the older Dialogflow chain pulls protobuf 6.x and can be rejected by the package security firewall during a clean install.

**Why:** A deploy can fail before the start command while an older running instance remains healthy, making the failure look like a runtime outage. The dependency was upgraded to the Dialogflow 7.x line, which supports Node 18+ and resolves protobuf 7.6.5.

**How to apply:** When changing API dependencies, validate the committed lockfile contains no protobuf 6.x packages and use the production `api/` package files as the deploy source.