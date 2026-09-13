---
name: Participant notification deep links
description: Secure CTA behavior for role-scoped participant notification emails
---

Participant notification links must carry a short-lived server-signed capability bound to the room, invite, and invite role. The API exchanges it for the existing participant session; URL role parameters remain presentation-only. Use SESSION_SECRET first and the existing server-only service key as a compatibility fallback for older Render environments.

**Why:** A role-and-tab URL without an invite credential falls through to anonymous access and the owner OTP flow, while trusting the URL role would weaken cross-role authorization. Missing the newer signing secret must not silently prevent the notification dispatcher from reaching the email provider.

**How to apply:** Use the signed capability for participant notification CTAs, preserve the requested tab through verification redirects, and derive the effective role from the verified invite/session rather than the query string.