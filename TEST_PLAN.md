# Test Plan

This document outlines test cases for core marketplace flows and edge conditions.

## Listing Lifecycle

### Happy Path
1. **Create and list a listing**
   - Provide all required fields and publish the listing.
   - Verify that the listing appears in the network feed.
2. **Watch listing**
   - Join the watch list and confirm notifications are delivered.
3. **Submit offer**
   - Buyer submits a valid offer.
   - Listing owner receives the offer notification.
4. **Counter offer**
   - Seller issues a counter offer.
   - Buyer receives the counter notification.
5. **Accept offer and create trade**
   - Buyer accepts the counter offer.
   - Trade record is created from the accepted offer.
6. **Sign and settle**
   - Both parties sign trade documents.
   - Settlement completes and trade status becomes `settled`.

### Edge Cases
- Missing mandatory fields during listing creation.
- Watcher tries to join twice.
- Offer exceeds listing constraints.
- Counter offer after acceptance.
- Signing with invalid credentials.
- Settlement failure due to network issues.

## Visibility Modes

### Happy Path
- Create listings in `private`, `invite_only`, and `network` modes and verify that:
  - `private` listings are visible only to the owner.
  - `invite_only` listings are visible to invited users.
  - `network` listings are visible to the entire network.

### Edge Cases
- Attempt to access a `private` listing by a non-owner.
- Invitee tries to access an expired invitation.
- Listing visibility changed after creation.

## Row-Level Security (RLS)

### Happy Path
- Buyer can view only its own offers on a listing.
- Listing parties can access associated documents.

### Edge Cases
- Non-party attempts to view offer details.
- External user attempts to download trade documents.

## Settlement Webhook

### Happy Path
- Webhook triggers on settlement and acknowledges receipt using an idempotency key.
- Subsequent identical webhook with same key is ignored.

### Edge Cases
- Webhook delivery fails and retried up to the configured limit.
- Duplicate webhook with different idempotency key creates multiple settlements.

## Offer and Listing Expiration

### Happy Path
- Offer automatically expires after its validity period and is removed from active offers.
- Listing withdrawn before offer is accepted becomes unavailable.

### Edge Cases
- Accepting an expired offer returns an error.
- Attempt to watch a withdrawn listing.
- Compliance hold prevents trade creation until resolved.
