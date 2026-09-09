---
name: Deployment-neutral DOCX ingestion
description: Text-based DOCX files must be unpacked and read from word/document.xml before analysis.
---

Use a self-contained ZIP/XML extraction path for ordinary text-based DOCX uploads instead of relying on a runtime binary or an untracked parser package. Every Deal Room entry point must call it, including custom-pack generic AI uploads; keep PDF and spreadsheet branches unchanged.

**Why:** The API is deployed separately from the UI and must behave consistently across the Replit preview and the external Render service; adding a system dependency would make valid DOCX ingestion environment-dependent.

**How to apply:** When changing document analysis, preserve the DOCX branch and route every structured-analysis entry point through the shared extracted text rather than decoding DOCX bytes as UTF-8. A re-upload with the same source hash must refresh an active stale/unreadable analysis instead of returning its old row unchanged.