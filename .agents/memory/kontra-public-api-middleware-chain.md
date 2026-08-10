---
name: Kontra public API middleware chain
description: The five middleware layers that block /api/public/ deal-room routes and the bypass pattern required for each.
---

# Kontra public API middleware chain

## The problem
`/api/public/deal-room/:id/*` routes are served by handlers registered late in
`index.js` (line 6794+). Several middleware layers run BEFORE those handlers
and block public requests unless each one has an explicit bypass.

## Layers and their bypass

All bypasses use the same dual-check pattern:
```js
const fullUrl    = req.originalUrl || '';
const mountedUrl = req.url || '';          // Express strips mount prefix here
if (fullUrl.includes('/api/public/') || mountedUrl.startsWith('/public/')) {
  return next();
}
```

| File | Why it fires | Bypass added? |
|---|---|---|
| `middlewares/authenticate.js` | `app.use('/api', authenticate, requireRole('admin'), complianceRouter)` — always registered because `compliance` is in DEFAULT_FLAGS | ✅ |
| `middlewares/requireRole.js` | Chained after authenticate in the compliance block; runs even when authenticate skips | ✅ |
| `middlewares/requireOrg.js` | 9 routers (orders, payments, aiReviews, billing, loanGovernance, analytics, paymentsStablecoin, capitalMarketsTokens, marketplace) all do `router.use(requireOrg)` at the top; mounted at `/api` so they see every request | ✅ |
| `middleware/orgContext.js` | Same pattern as requireOrg, used by three stablecoin/token routers | ✅ |
| `src/middleware/requireOrgContext.js` | `app.use('/api', requireOrgContext)` at line 5099; already had `/api/public/` bypass but also added mount-relative `/public/` check | ✅ |

## 404 catch-all ordering bug
`app.use('/api', 404handler)` was registered at line ~6526, BEFORE the
transaction-record (6794) and brain/facts (7331) routes. Express matches in
registration order — the catch-all swallowed those routes before they could
respond.

**Fix:** moved 404 handler + Sentry + errorHandler to the very end of the file
(after `module.exports = app`).

## Why: how to add new /api/public/ routes safely
1. Register the route BEFORE the `app.use('/api', 404handler)` at the end.
2. Do NOT use any of the five middleware files above without the bypass — they
   all run for any `/api/...` path, including public ones.
3. Use `getRoomAccessContext(req, propertyId)` inside the handler for auth.

## Brain endpoint auth boundary
`app.use('/api/public/deal-room/:propertyId/brain', ...)` at line 5076 is an
intentional auth gate for the AI Operations Manager. It calls
`getRoomAccessContext` and blocks anonymous access. The frontend MUST send
`x-owner-write-token` when fetching `/brain/briefing`, `/brain/ask`, etc.
