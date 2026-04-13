# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Kontra UI (Main Application)

The primary application lives in `kontra-ui-clone/` — a full loan servicing workspace for multifamily/CRE loans.

### Key directories
- `kontra-ui-clone/ui/` — React + Vite frontend (served on PORT 23452 via `artifacts/kontra-ui: web` workflow)
- `kontra-ui-clone/api/` — Express backend (PORT 3000, Supabase-backed, `Kontra API Backend` workflow)

### Auth & Multi-tenancy
- Supabase project: `jfhojgtnmcfqretrrxam` (region: us-east-1)
- Main user: `gamilsaad@kontraplatform.com` → org_id=12 "Kontra Platform", role=admin
- All 9 demo users share password: `KontraDemo2024!`
- OrgProvider (`ui/src/lib/OrgProvider.tsx`) bootstraps org context via `/api/me/bootstrap` after auth
- `AuthedOrgProvider` in `App.jsx` wraps routes so OrgProvider has session access

### Artifact routing
- `artifacts/kontra-ui` — dev script cd's into `kontra-ui-clone/ui/` and runs its Vite (PORT 23452)
- Preview path `/` shows the Kontra UI login page

### Tokenization (simplified ERC-20 pool token flow)
One ERC-20 token per pool on Base. All financial logic (NAV, DSCR, distributions) stays fully off-chain. Blockchain = mint/burn/transfer/track ownership only.

**Flow**: Create pool → Add loans → Click "Tokenize" (set symbol + supply) → Assign allocations to whitelisted investor wallets.

**Key files:**
- `kontra-ui-clone/api/src/routes/markets.js` — 5 new endpoints: `/pools/:id/tokenize`, `/pools/:id/allocations` (GET/POST/DELETE), `/whitelist` (GET/POST/DELETE)
- `kontra-ui-clone/ui/src/components/OnchainDashboard.tsx` — clean 3-tab UI (Tokenize / Allocations / Whitelist), no wallet library required
- `kontra-ui-clone/api/migrations/001_canonical_schema.sql` — includes `pool_allocations` and `pool_whitelist` tables

**DB tables added (run migration in Supabase SQL editor):**
- `pool_allocations(id, org_id, pool_id, investor_name, wallet_address, token_amount, ...)`
- `pool_whitelist(id, org_id, wallet_address, investor_name, kyc_status, ...)`
- Token metadata stored in `pools.data` JSONB: `token_symbol`, `token_supply`, `token_contract_address`, `token_network`, `token_status`

**No wallet connect required in UI.** Contract address is entered manually after deploying the minimal ERC-20 on Base.

### Pending setup (needed for full functionality)
1. Run `kontra-ui-clone/api/migrations/001_canonical_schema.sql` in Supabase SQL editor (includes the new tokenization tables)
2. Set `SUPABASE_SERVICE_ROLE_KEY` on Render and redeploy the production API
3. Remove `DATABASE_URL` env var from Render dashboard (wrong password causes psql fallback noise)

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

---

## Kontra Platform (kontra-ui-clone/)

Full-stack multifamily/CRE loan servicing platform. Lives in `kontra-ui-clone/`.
Vision: AI-native headless servicing and tokenization OS for enterprise real estate finance.
Target: $40M SaaS ARR + $37.5M transaction fees = ~$77.5M combined annual revenue.

### Portals
- `/dashboard` — Lender Portal (burgundy #800020)
- `/servicer` — Servicer Portal (amber accent)
- `/investor` — Investor Portal (violet)
- `/borrower` — Borrower Portal (emerald)
- `/select-portal` — Multi-portal selection (4-card grid)

### Phase 1: Enterprise Core (COMPLETED)
Phase 1 transforms Kontra from a dashboard app into a structured workflow engine with a canonical data architecture and headless API.

**Canonical Data Architecture** — `kontra-ui-clone/api/schema-phase1-canonical.sql`
11 new entity tables: `borrowers`, `properties`, `deficiencies`, `hazard_loss_events`, `reserves`, `covenants`, `maturities`, `watchlist_items`, `approvals`, `webhook_configs`, `webhook_deliveries`

**Workflow Template Library** — `kontra-ui-clone/api/lib/workflowTemplates.js`
6 machine-readable workflow templates with triggers, steps, SLAs, and typed step nodes:
- `inspection_review` (7 steps, 72h SLA) — triggers: inspection-uploaded, draw-submitted
- `hazard_loss_disbursement` (7 steps, 120h SLA) — triggers: hazard-loss-filed
- `watchlist_review` (6 steps, 48h SLA) — triggers: watchlist-added, delinquency-threshold
- `borrower_financial_analysis` (7 steps, 96h SLA) — triggers: financial-uploaded, annual-review-due
- `maturity_tracking` (8 steps, 168h SLA) — triggers: maturity-t90, extension-requested
- `covenant_monitoring` (9 steps, 24h SLA) — triggers: covenant-test-due, covenant-breach

**Headless API Endpoints** — `kontra-ui-clone/api/src/routes/workflows.js`
- `GET /api/workflow-templates` — list all templates
- `GET /api/workflow-templates/:id` — get single template with full step graph
- `POST /api/workflows/from-template` — launch from template with SLA deadline
- `GET /api/approval-queue` — pending human reviews for this org
- 5 new trigger endpoints: hazard-loss-filed, watchlist-added, maturity-t90, covenant-test-due, delinquency-threshold
- Priority routing: covenant-breach=P1, watchlist/hazard=P2, maturity=P3

**Workflow Engine UI** — `kontra-ui-clone/ui/src/pages/dashboard/WorkflowEnginePage.tsx`
Full operational OS with 5 tabs:
- Instances — live kanban board (queued/running/needs_review/completed) with SLA countdown, retry/cancel actions
- Templates — 6 template cards with step graph expansion and launch modal
- Approvals — human review queue with inline approve/reject/request changes
- Audit Log — immutable chronological trail (actor type: AI/Human/System, action codes)
- API & Webhooks — endpoint reference (19 endpoints), webhook config with HMAC signing, canonical entity schema map

### API (`kontra-ui-clone/api/`)
- Express + Supabase (PostgreSQL with RLS)
- Production: `https://kontra-api.onrender.com`
- Key files: `src/lib/crud.js`, `src/middleware/requireOrgContext.js`, `src/routes/entityRouter.js`
- Integer org IDs → UUID conversion: `00000000-0000-0000-0000-{12-digit-padded}`
- All entity create endpoints return 201; `items/total` response shape

### Frontend (`kontra-ui-clone/ui/`)
- React + Vite + TailwindCSS
- Production: `https://kontraplatform.com` (Vercel)
- Modules: Dashboard, Portfolio, Servicing, Governance, Markets, On-Chain, AI, Reports

### iOS App (`github.com/gamilsaad92/kontra-ios`)
- Swift 5.9 + SwiftUI, iOS 17+, MVVM + async/await
- 27 source files pushed to GitHub on 2026-04-01
- Connects to same REST API as the web frontend
- Auth: Supabase JWT stored in iOS Keychain
- Tabs: Dashboard · Portfolio · Servicing · Governance · Markets
- Modules: Loans, Assets, Payments, Inspections, Draws, Escrows, Compliance, Risk, Legal, Regulatory Scans, Document Reviews, Pools (with tokenization), Tokens, Exchange Listings, AI Reviews, Reports, Settings
- Generic `EntityListPage` + `EntityListViewModel<T>` used for all modules
- `APIClient.shared` — central URLSession wrapper with org ID header injection
