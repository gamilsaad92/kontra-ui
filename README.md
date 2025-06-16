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

2. Start the development servers in separate terminals:
   ```bash
   # API (defaults to PORT from `.env` or 5050)
   cd api && npm run dev

   # UI (Vite defaults to port 5173)
   cd ui && npm run dev
   ```

   The signup form sends Supabase magic links back to `window.location.origin`. 
   Ensure the UI is running on the same host/port that served the form (typically `http://localhost:5173`).

3. Run tests:
   ```bash
   cd api && npm test
   ```

   Tests require `jest` installed locally.
