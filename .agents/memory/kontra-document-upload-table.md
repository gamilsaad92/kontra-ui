---
name: Kontra document upload table
description: Documents are stored in deal_analyses, not deal_documents. The deal_documents table does not exist.
---

# Kontra document upload table

## Rule
All document uploads write to **`deal_analyses`**. There is no `deal_documents` table.

For any live workflow, read only the active document version per `section`;
superseded rows are audit history, not evidence. Legacy rows without a version
marker use the newest row in the section until the additive version migration
has run.

**Why:** A replacement may correct or withdraw document-derived facts. Letting
older summaries or findings remain in live calculations can re-open resolved
issues, double-count completion, or overwrite a coordinator's current work.

**How to apply:** Any task, readiness, conflict, or summary query over
`deal_analyses` must use the shared active-version projection (or equivalent
filtering) and expose historical versions only in audit-oriented UI.

**Why:** The upload flow (file → AI summary → structured analysis) stores results
in `deal_analyses` via `supabase.from('deal_analyses').insert(...)`. Five
endpoints were incorrectly querying `deal_documents` (always 0 rows), causing
empty-room / "Start this transaction" states in the Overview.

## Affected endpoints (fixed)
- `GET /api/public/deal-room/:id/readiness`
- `GET /api/public/deal-room/:id/asset-metadata`
- `GET /api/public/deal-room/:id/asset-package`
- `POST /api/public/deal-room/:id/brain/ask`
- `GET /api/public/deal-room/:id/brain/briefing` (the facts-summary version)

## Column map
| Wrong | Correct |
|---|---|
| `deal_documents` | `deal_analyses` |
| `source_document` | `source_doc_id` |
| `room.entity_name` (in deal_rooms SELECT) | `metadata_values.entity_name` (join metadata_values) |

## Canonical query
```js
const { data, error } = await supabase
  .from('deal_analyses')
  .select('id, section, ai_summary, document_type, storage_path, created_at')
  .eq('property_id', propertyId);
```
