---
name: Kontra checkout pack durability
description: Durable rules for carrying AI-generated workflow configuration from checkout into the final deal room
---

Generated workspace configuration must be persisted before payment and carried in durable payment metadata. The Stripe webhook may execute on a different Render instance, so an in-memory checkout-to-webhook map cannot be the source of truth for the custom pack ID or room metadata.

**Why:** When the webhook lost the in-memory handoff, the room was created with the CRE default even though the AI-generated custom pack row existed. The same fallback also affected initial stages because the API's built-in stage registry does not contain `ws_*` packs.

**How to apply:** Save the custom pack before creating checkout, include its `ws_*` ID and room metadata in Stripe metadata, read those values in the webhook, and load custom stages/documents from `custom_workflow_packs` rather than calling a built-in pack fallback.