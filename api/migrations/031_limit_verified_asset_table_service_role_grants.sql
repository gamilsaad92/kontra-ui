-- Keep service_role access limited to the operations used by the production API.
-- Snapshots are append-only and are read by readiness, history, and package routes.
REVOKE ALL PRIVILEGES
  ON TABLE public.verified_asset_snapshots
  FROM service_role;
GRANT SELECT, INSERT
  ON TABLE public.verified_asset_snapshots
  TO service_role;

-- PDF artifact metadata is read and inserted by artifact routes, and deleted
-- only after its stored PDF is removed during deal-room cleanup.
REVOKE ALL PRIVILEGES
  ON TABLE public.digital_asset_preparation_pdf_artifacts
  FROM service_role;
GRANT SELECT, INSERT, DELETE
  ON TABLE public.digital_asset_preparation_pdf_artifacts
  TO service_role;