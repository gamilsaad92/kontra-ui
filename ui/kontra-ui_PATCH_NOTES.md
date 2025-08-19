# Kontra UI Integration Patch Notes

Added:
- `src/lib/http.js` — unified fetch wrapper (Bearer + X-Org-Id).
- `src/lib/orgContext.jsx` — global organization selection context.
- `src/lib/useResource.js` — generic hooks for list/mutate patterns.
- `src/components/OrgSelect.jsx` — sidebar organization picker (loads from `/api/organizations/list`).

Modified:
- `src/main.jsx` — wrapped `<App />` with `<OrgProvider>`.
- `src/components/DashboardLayout.jsx` — added `<OrgSelect />` under department switcher.

Usage:
- Inside any tab component:
  ```js
  import { useList, useMutate } from '../lib/useResource'
  const { data, loading, error, reload } = useList('/api/loans')
  const { post } = useMutate('/api/payments/record')
  ```

Env:
- `VITE_API_URL` must point to your API base (defaults to `http://localhost:5050` if unset).

Rollback:
- Delete new files and revert `main.jsx` and `DashboardLayout.jsx` to prior versions.