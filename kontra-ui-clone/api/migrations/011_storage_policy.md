# Storage Bucket Policy for deal-documents

Apply this in the Supabase Dashboard:
**Storage → deal-documents bucket → Policies → New policy → For full customization**

## Settings
- **Policy name:** `deal_room_owner_or_participant_download`
- **Allowed operation:** SELECT only (uncheck INSERT / UPDATE / DELETE)
- **Target roles:** leave empty (defaults to all/public)

## USING expression (paste exactly)

```sql
bucket_id = 'deal-documents'
AND (
  EXISTS (
    SELECT 1 FROM deal_rooms dr
    WHERE dr.property_id = (storage.foldername(name))[1]
      AND lower(auth.email()) = lower(dr.customer_email)
  )
  OR
  EXISTS (
    SELECT 1 FROM deal_room_access_sessions s
    JOIN deal_room_invites i ON i.id = s.invite_id
    WHERE i.property_id = (storage.foldername(name))[1]
      AND s.session_token_hash = encode(
            digest(
              coalesce(current_setting('request.headers', true)::json->>'x-kontra-session', ''),
              'sha256'
            ), 'hex'
          )
      AND s.expires_at > now()
      AND s.revoked_at IS NULL
  )
)
```

## Notes
- `deal_room_access_sessions` has no direct `property_id` column — it joins through
  `deal_room_invites` via `invite_id`.
- Storage path convention must be `{property_id}/{filename}` for `foldername()` to work.
- The `validate_session_for_property` RPC uses the same join pattern.
