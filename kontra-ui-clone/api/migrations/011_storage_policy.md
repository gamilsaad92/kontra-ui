# Storage Bucket Policy for deal-room-documents

Apply this in the Supabase Dashboard → Storage → deal-room-documents bucket → Policies.

## Policy: participant_download

**Bucket:** deal-room-documents  
**Operation:** SELECT (download)  
**Definition:**

```sql
(
  -- Owner of the deal room
  EXISTS (
    SELECT 1 FROM deal_rooms dr
    WHERE dr.property_id = (storage.foldername(name))[1]
      AND lower(auth.email()) = lower(dr.customer_email)
  )
)
OR
(
  -- Participant with a valid invite session token
  validate_session_for_property((storage.foldername(name))[1])
)
```

This assumes deal-room document storage paths use `{property_id}/filename` as the convention.
The `validate_session_for_property` function (created in 011_invite_security.sql) checks
the `x-kontra-session` header against the `deal_room_access_sessions` table server-side.
