---
name: AI data-handling boundary
description: Durable rules for institutional AI traffic, sensitive identifiers, and scanned-document processing
---

Institutional Deal Room, document, and grounding traffic must stay on the approved standard OpenAI Chat Completions path with an explicitly pinned standard base URL and `store: false`. Sensitive identifiers such as SSNs and EINs must be removed before general model extraction, provider failures must be represented by safe metadata or generic user-facing errors, and agent-step traces must remain metadata-only.

**Why:** The product handles institutional transaction documents and must avoid accidental provider-side state, sensitive-identifier disclosure, raw provider fragments in logs, and silently incomplete scanned-document analysis.

**How to apply:** Route new institutional calls through the shared client wrapper; render every bounded scanned-PDF page or reject it explicitly; keep audit/Sentry and agent-step records to operational metadata only; require production encryption keys.