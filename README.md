# Kontra UI Monorepo

This repository contains the **frontend** and **backend** for the Kontra demo application.

- `ui/` – React + Vite web interface
- `api/` – Express API with Supabase integration

## Getting Started

1. Install dependencies for each package:
   ```bash
   cd api && npm install
   cd ../ui && npm install
   ```

2. Configure environment variables:
   ```bash
   # API keys and port
   cp api/.env.example api/.env
   # URL of the running API for the frontend
   cp ui/.env.example ui/.env
   ```

   Edit `api/.env` with your Supabase and OpenAI credentials. Ensure the API is
   running on the same URL specified in `ui/.env`.

3. Start the development servers in separate terminals:
   ```bash
   # API (defaults to PORT from `.env` or 5050)
   cd api && npm run dev

   # UI (Vite defaults to port 5173)
   cd ui && npm run dev
   ```

   The signup form sends Supabase magic links back to `window.location.origin`. 
   Ensure the UI is running on the same host/port that served the form (typically `http://localhost:5173`).

4. Run tests:
   ```bash
   cd api && npm test
   ```

   Tests require `jest` installed locally.

## Loan Application API

The API exposes basic endpoints for submitting and reviewing loan applications.

* `POST /api/loan-applications` – submit a new application (supports `multipart/form-data` with a `document` upload)
* `GET /api/loan-applications` – list submitted applications

These routes perform mock KYC and credit checks before storing the application in Supabase.

## Escrow Administration

Phase 4 introduces an `escrows` table tracking tax and insurance reserves for each loan. A Supabase Edge Function (`api/edge-functions/fetchTaxBills.js`) can be scheduled monthly to update real-world tax amounts. The UI exposes an "Escrows" dashboard showing the latest amounts and account balance.

## Phase 5

Collections, investor reporting and asset management follow the same pattern:

1. **Data model** – tables are defined in `api/schema-phase5.sql` for `collections`, `investor_reports` and `assets`.
2. **API routes** – new CRUD endpoints are implemented in `api/index.js` under `/api/collections`, `/api/investor-reports` and `/api/assets`.
3. **UI pages** – React components in `ui/src/components` display and create records for these tables.
4. **Workflows** – background jobs (`api/workerCollections.js` and `api/edge-functions/updateAssetValues.js`) illustrate how Render cron jobs or Supabase Scheduled Functions keep data in sync.
