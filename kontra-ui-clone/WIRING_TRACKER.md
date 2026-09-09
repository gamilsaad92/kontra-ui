# Kontra Wiring Tracker

| Module | Screen | Action | Frontend function name | API endpoint | Exists? | Status | Owner route and file path |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Servicing | AI Payment Ops | Run AI Review | `handleRunReview` | `POST /api/ai/payments/review` | Y | wired | `/servicing/payments` — `ui/src/pages/dashboard/servicing/ServicingPaymentsPage.tsx` |
| Servicing | AI Payment Ops | Update review status | `handleMark` | `POST /api/ai/reviews/:id/mark` | Y | wired | `/servicing/payments` — `ui/src/pages/dashboard/servicing/ServicingPaymentsPage.tsx` |
| Servicing | AI Payment Ops | Approve posting/action | `handleApprovePosting` / `handleAction` | `POST /api/ai/reviews/:id/approve-action` | Y | wired | `/servicing/payments` — `ui/src/pages/dashboard/servicing/ServicingPaymentsPage.tsx` |
| Servicing | AI Payment Ops | View review queue | `loadReviews` | `GET /api/ai/reviews` | Y | wired | `/servicing/payments` — `ui/src/pages/dashboard/servicing/ServicingPaymentsPage.tsx` |

## Execution order status
1. **Auth + Org context**: in progress (shared client now sends both `x-organization-id` and `x-org-id`, plus standardized error events).
2. **Core lists + detail pages**: in progress (Servicing Payments queue moved to canonical loading/empty/error states with no mock fallback).
3. **Submit/create/update actions**: in progress (Servicing Payments AI actions validated end-to-end).
4. **Background jobs / AI review triggers**: in progress (payment/inspection triggers validated with typed schemas).
5. **Reports exports**: pending.
