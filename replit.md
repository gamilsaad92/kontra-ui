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

### Role-Based Access Control (RBAC)
Two-layer guard system for portals:
1. **`RequireAuth`** (`ui/src/app/guards/RequireAuth.tsx`) — checks authentication only (valid session)
2. **`RequireRole`** (`ui/src/app/guards/RequireRole.tsx`) — checks authorization (role matches portal)

Portal access matrix:
- `/dashboard/*` (lender) → `platform_admin`, `lender_admin`, `asset_manager`
- `/servicer/*` → `platform_admin`, `lender_admin`, `servicer`, `asset_manager`
- `/investor/*` → `platform_admin`, `investor`
- `/borrower/*` → `platform_admin`, `borrower`

Cross-portal access is blocked silently: unauthorized users are redirected to their own portal.

Role routing (`usePortalRouter.ts`):
- `investor` → `/investor`
- `borrower` → `/borrower`
- `servicer` → `/servicer/overview`
- `asset_manager`, `lender_admin`, `platform_admin` → `/select-portal` or `/dashboard`

### Mobile Auth
- `artifacts/kontra-mobile/context/AuthContext.tsx` — real Supabase auth via API proxy
- Login calls `POST /api/auth/signin` → JWT returned → role decoded from `app_metadata.app_role`
- Session persisted in AsyncStorage under `kontra_mobile_session`
- API URL configured via `EXPO_PUBLIC_API_URL` in `artifacts/kontra-mobile/.env`
- Defaults to `https://kontra-api.onrender.com` if env not set

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

## Phase 3: Dynamic Policy Engine (COMPLETED 2026-04-13)

### New Files
- `kontra-ui-clone/api/lib/policyEngine.js` — 3-tier rule evaluation: (1) Org override → (2) Published DB rule → (3) Hardcoded fallback. 28 canonical rules in fallback registry. Logs every evaluation to `kontra_rule_audit_log`. Exposes `evaluateRule()`, `evaluateCategory()`, `getRuleById()`, `getPolicyStats()`.
- `kontra-ui-clone/api/schema-phase3-policy.sql` — DB schema extensions: `source_agency`, `override_allowed`, extended category CHECK constraint (9 new categories), `kontra_rule_overrides` table, `kontra_agent_rule_dependencies` table, audit log enrichment columns.
- `kontra-ui-clone/api/seed-phase3-regulatory-rules.sql` — 38 canonical regulatory rules seeded across: freddie_mac (10), fannie_mae (3), hazard_loss (4), watchlist (4), reserve (3), maturity (4), token_transfer (5), lender_specific (3), compliance (2).
- `kontra-ui-clone/ui/src/pages/dashboard/PolicyEnginePage.tsx` — Regulatory Intelligence Hub: 6 stats cards, 8 category cards, live rule evaluator panel, agent→rule dependency map (6 agents × 22 rules), recent evaluations audit feed, rule lifecycle + override explainer.

### Updated Files
- `kontra-ui-clone/api/lib/agentToolRegistry.js` — `validateFreddieRule()` now async, routes through `policyEngine.evaluateRule()` (DB-first), falls back to emergency synchronous registry if both fail.
- `kontra-ui-clone/ui/src/pages/SaasDashboard.tsx` — added `PolicyEnginePage` import + `/policy` route.
- `kontra-ui-clone/ui/src/routes.jsx` — added "Policy Engine" nav item with `ShieldCheckIcon` between Workflow Engine and Agent Console.

### Rule Categories (Phase 3)
freddie_mac | fannie_mae | hazard_loss | watchlist | reserve | maturity | token_transfer | lender_specific | compliance | draw_eligibility | cfpb | hud | investor_eligibility | jurisdiction

### DB Tables Added
- `kontra_rule_overrides` — org-level rule overrides with type, value, effective dates, status, and role requirements
- `kontra_agent_rule_dependencies` — agent ↔ rule usage map (evaluates / triggers_on / blocks_on)

## Phase 4: Integration & Legacy Modernization Layer (COMPLETED 2026-04-14)

### New Files
- `kontra-ui-clone/api/lib/documentIntelligence.js` — OCR + structured extraction engine. 11 typed extraction schemas (loan_document, appraisal_report, insurance_acord, inspection_report, rent_roll, operating_statement, reserve_report, draw_request, email_request, spreadsheet). Uses gpt-4o-mini function-calling with confidence scoring. Full demo mode when OPENAI_API_KEY unavailable.
- `kontra-ui-clone/api/lib/legacyAdapters.js` — 10 source system adapters: FICS, Situs/AMC, Yardi, MRI, Trepp/RiskMetrics, generic spreadsheet/CSV, email/fax, inspection vendor, insurance ACORD, reserve XML. Each adapter is a stateless `normalize(rawData) → KontraSchema` function with utility parsers (parseNum, parsePct, parseDate, mapLoanType, mapPropertyType).
- `kontra-ui-clone/api/src/routes/integrationHub.js` — 7 API endpoints: classify, extract (multipart), ingest (adapter-normalized), email-parse, csv-preview, jobs (queue), stats. In-memory job queue with DB persistence. Pre-seeded with 7 demo jobs.
- `kontra-ui-clone/api/schema-phase4-integration.sql` — 4 new tables: `kontra_integration_jobs`, `kontra_integration_sources` (pre-seeded with 10 adapters), `kontra_document_extractions`, `kontra_email_requests`. Full indexing for status, doc_type, org_id.
- `kontra-ui-clone/ui/src/pages/dashboard/IntegrationHubPage.tsx` — Integration Hub UI with 4 tabs: Doc Intelligence (upload zone + extraction results), Adapters (10 cards + capabilities table), Email Parser (textarea → structured request), Job Queue (filtered table + failure alerts). 6-stage pipeline visualizer.

### Updated Files
- `kontra-ui-clone/api/index.js` — mounted `integrationHubRouter` at `/api/integration`
- `kontra-ui-clone/ui/src/pages/SaasDashboard.tsx` — added `IntegrationHubPage` import + `/integration` route
- `kontra-ui-clone/ui/src/routes.jsx` — added "Integration Hub" nav item with `LinkIcon` (before Policy Engine)

### API Endpoints (Phase 4)
- `POST /api/integration/extract` — multipart file upload → classify → OCR extract → structured JSON
- `POST /api/integration/classify` — auto-classify document type
- `POST /api/integration/ingest` — run adapter, normalize, return unified schema object
- `POST /api/integration/email-parse` — email text → structured servicing request
- `POST /api/integration/csv-preview` — parse CSV, detect columns, recommend adapter
- `GET  /api/integration/adapters` — list all 10 adapters
- `GET  /api/integration/jobs` — integration job queue with status filters
- `GET  /api/integration/stats` — dashboard stats

### Extraction Schemas (11 types)
loan_document (23 fields) | appraisal_report (18 fields) | insurance_acord (17 fields) | inspection_report (deficiency array) | rent_roll (unit_mix array) | operating_statement (expense breakdown) | reserve_report (pending_draws array) | draw_request (line items array) | email_request (9 fields + classification) | spreadsheet (column auto-detection) | title_report / environmental_report (classified)

## Phase 5: Headless Enterprise Interoperability Layer (COMPLETED 2026-04-14)

### New Files
- `kontra-ui-clone/api/lib/modelRouter.js` — External LLM routing engine. Supports 5 providers: openai, azure_openai, anthropic, bedrock, ollama. Per-task priority chains (TASK_ROUTING map). Per-org config override (setOrgConfig). In-memory audit ring buffer (500 entries) with latency, cost-per-token estimates, and provider fallback on error. Functions: route(), getStats(), getAuditLog().
- `kontra-ui-clone/api/lib/eventBus.js` — In-process EventEmitter + outbound webhook dispatcher. 20+ canonical event types (loan.*, draw.*, agent.*, policy.*, document.*, token.*). HMAC-SHA256 webhook signatures with `X-Kontra-Signature` header. 3-attempt exponential retry (1s→2s→4s). SSE stream subscriber set. Functions: emit(), on(), registerWebhook(), listWebhooks(), getEvents(), getDeliveries().
- `kontra-ui-clone/api/lib/pluginConnector.js` — Plugin connector registry. 10 built-in connectors with standard execute() interface: Slack, Salesforce, Jira, ServiceNow, Microsoft Teams, HubSpot, DocuSign, SendGrid, PagerDuty, Fivetran. Each connector: authType, actions array, execute(action, payload, credentials). Demo mode when credentials = 'demo'. Functions: install(), uninstall(), execute(), listInstalled().
- `kontra-ui-clone/api/src/routes/headlessApi.js` — /api/v1 versioned enterprise REST API. Endpoints: /complete (model router), /models, /models/config, /models/stats, /models/audit, /webhooks (CRUD + ping), /events (log + emit), /events/stream (SSE), /plugins (catalog + install + execute), /api-keys (create + revoke), /stats (combined), /health, /openapi (full OpenAPI 3.1 JSON spec).
- `kontra-ui-clone/api/schema-phase5-enterprise.sql` — 6 new tables: kontra_webhooks, kontra_webhook_events, kontra_event_log (partition hint: month), kontra_model_routes, kontra_api_keys (hash+prefix pattern), kontra_plugin_installs. Pre-seeded 3 demo webhooks + 7 event log entries.
- `kontra-ui-clone/ui/src/pages/dashboard/EnterpriseApiPage.tsx` — 6-tab Enterprise API Console at /enterprise-api: Model Router (provider selector, inference playground, audit table), Webhooks & Events (quick-emit panel, register form, hook list, delivery status), Plugin Marketplace (install/execute 10 connectors), API Key Manager (create/revoke, masked display), OpenAPI Explorer (grouped by tag, expandable), SSE Live Stream (dark terminal, pause/resume, 100-event ring).

### Updated Files
- `kontra-ui-clone/api/index.js` — mounted headlessApiRouter at /api/v1
- `kontra-ui-clone/ui/src/pages/SaasDashboard.tsx` — added EnterpriseApiPage import + /enterprise-api Route
- `kontra-ui-clone/ui/src/routes.jsx` — added "Enterprise API" nav item with GlobeAltIcon + GlobeAltIcon import

### API Surface (/api/v1)
POST /complete | GET /models | PUT /models/config | GET /models/stats | GET /models/audit | GET /webhooks | POST /webhooks | PATCH /webhooks/:id | DELETE /webhooks/:id | POST /webhooks/:id/ping | GET /webhooks/:id/deliveries | GET /events | POST /events/emit | GET /events/stream (SSE) | GET /plugins | GET /plugins/installed | POST /plugins/install | DELETE /plugins/install/:id | POST /plugins/install/:id/execute | GET /api-keys | POST /api-keys | DELETE /api-keys/:id | GET /stats | GET /health | GET /openapi

### Providers (modelRouter)
openai (gpt-4o-mini, $0.15/$0.60 per 1M) | azure_openai (env: AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_DEPLOYMENT) | anthropic (claude-3-haiku, $0.25/$1.25 per 1M) | bedrock (claude-3-haiku, AWS SDK) | ollama (llama3.2:3b, $0 local)

## Phase 6: Tokenization Execution Layer (COMPLETED 2026-04-14)

### New Files
- `kontra-ui-clone/api/lib/tokenizationEngine.js` — Tokenization Readiness Agent. 5-dimension assessment: Data Completeness (20%), Servicing History Integrity (25%), Compliance Readiness (25%), Covenant Status (15%), Legal Document Sufficiency (15%). Score ≥85=token_ready, 65-84=conditional, <65=not_ready. Each dimension returns issues tagged as blocking/conditional/warning. Blocking issues prevent tokenization regardless of score. 19 required loan fields, 13 required documents, ERC-1400 compliance checklist (8 requirements). assessReadiness(loan, {servicingHistory, compliance, covenants, documents}) returns full assessment with assessmentId, score, status, dimensions, blockingIssues, conditionalIssues, recommendations.
- `kontra-ui-clone/api/lib/tokenRegistry.js` — ERC-1400 Token Registry. createTokenPackage() generates mock Ethereum contract address + IPFS document hash. Partitions: whole_loan, senior, mezzanine, equity. Investor wallet whitelist with KYC (pending/approved/rejected/expired), AML (pending/cleared/flagged), OFAC, accreditation, jurisdiction, and max position enforcement. checkTransferEligibility() returns ERC-1400 EIP-1066 status codes (0x51=allowed, 0x50=not authorized, 0x52=other). Hold period enforcement against purchase history. Stablecoin payment reconciliation (USDC/USDT/DAI/PYUSD/EURC, with raw on-chain integer via BigInt). Secondary market order book (bids/asks/trades). Governance proposals (6 types) with weighted voting and quorum tracking. seedDemoData() creates LN-0094 token package with 5 whitelisted wallets, 6 months of USDC payments, 4 orders, 1 governance proposal (maturity_extension with 3 votes cast).
- `kontra-ui-clone/api/src/routes/tokenizationApi.js` — /api/tokenization REST router (20+ endpoints). Mounted as phase6TokenizationRouter to avoid name clash with existing tokenizationRouter. Emits token.issued, token.transferred, agent.action events to eventBus on key operations.
- `kontra-ui-clone/api/schema-phase6-tokenization.sql` — 8 tables: kontra_token_packages (ERC-1400 metadata, offering params, chain data), kontra_investor_wallets (KYC/AML/OFAC status, jurisdiction, accreditation, approved_token_ids[]), kontra_token_transfers (transfer history with ERC-1400 types), kontra_stablecoin_payments (amount as human-readable + amount_raw as BigInt string), kontra_token_orders (order book), kontra_governance_proposals (options as JSONB array), kontra_governance_votes (UNIQUE constraint on proposal+voter), kontra_readiness_assessments (assessment history). All tables have appropriate indexes.
- `kontra-ui-clone/ui/src/pages/dashboard/TokenizationPage.tsx` — 7-tab Tokenization Platform at /tokenization. Tabs: Readiness Agent (gauge SVG, dimension breakdown, blocking/conditional issue lists, ERC-1400 checklist), Token Registry (token cards with issuance progress bar, token detail panel with all metadata + IPFS hash + jurisdiction pills), Investor Whitelist (stats, add-wallet form, KYC approval/rejection from table), Transfer Eligibility (token+wallet selector form, eligibility result with ERC-1400 status code, transfer history feed), Payment Reconciliation (filter tabs, reconcile button, stablecoin/type badges), Secondary Market (bid/ask tables with mid-price/spread, recent trades feed), Investor Governance (proposal cards with vote bars, cast-vote buttons, role switcher).

### Updated Files
- `kontra-ui-clone/api/index.js` — added `require('./src/routes/tokenizationApi')` as `phase6TokenizationRouter`, mounted at `/api/tokenization`
- `kontra-ui-clone/ui/src/pages/SaasDashboard.tsx` — added `import TokenizationPage` + `<Route path="/tokenization" element={<TokenizationPage />} />`
- `kontra-ui-clone/ui/src/routes.jsx` — added `{ label: "Tokenization", path: "/tokenization", icon: CubeTransparentIcon }` nav item (CubeTransparentIcon was already imported)

### API Surface (/api/tokenization)
GET /assess/demo | POST /assess | GET /packages | POST /packages | GET /packages/:id | PATCH /packages/:id/status | GET /whitelist | POST /whitelist | PATCH /whitelist/:address/kyc | DELETE /whitelist/:address | POST /transfer-check | POST /transfer | GET /transfers | GET /payments | POST /payments | PATCH /payments/:id/reconcile | GET /secondary-market/:tokenId | POST /secondary-market/order | GET /governance/proposals | POST /governance/proposals | POST /governance/vote | GET /stats | GET /erc1400-spec

### Readiness Scoring Logic
- Score 95/100 for demo LN-0094 (status: conditional; 4 conditional issues around DSCR being near covenant, occupancy, and others — no blocking issues)
- Transfer eligibility correctly blocks max-position-exceeded investor (holding $2.6M vs $2.0M cap) with ERC-1400 status code 0x52
- Pending KYC wallet blocked with 2 reasons (kyc_status not approved, aml_status not cleared)

### Stablecoins Supported
USDC (6 decimals) | USDT (6 decimals) | DAI (18 decimals) | PYUSD (6 decimals) | EURC (6 decimals)

### Governance Proposal Types
maturity_extension | rate_modification | property_disposition | servicer_replacement | covenant_waiver | special_distribution

---

## Phase 8 — Enterprise Command Centers (COMPLETE)

### Architecture
Redesigned the Kontra interface around 6 operational command centers. All centers share a single `CommandCenterShell.tsx` component that fetches from `/api/cc/:center/dashboard` and renders a consistent layout: KPI bar, live workflow queue with SLA progress, agent outputs, pending approvals, SLA breaches, and exception queue.

### New Files
- `kontra-ui-clone/api/src/routes/commandCentersApi.js` — Phase 8 backend. 6 center data factories (servicingData, inspectionData, hazardData, complianceData, exchangeData, adminData) each seeding 6 KPIs, 6-7 live workflows, 4 agent outputs, 3 approvals, 2 SLA breaches, 3 exceptions. Routes: GET /api/cc/centers, GET /api/cc/:center/dashboard, POST /api/cc/:center/actions/:actionId, GET /api/cc/action-log.
- `kontra-ui-clone/ui/src/pages/dashboard/CommandCenterShell.tsx` — Reusable command center shell. Polls every 30s, shows live/paused toggle, status pills, action buttons (Approve/Escalate), toast notifications, SLA progress bars color-coded by utilization (green/amber/red), priority badges.
- `kontra-ui-clone/ui/src/pages/dashboard/ServicingOperationsCenter.tsx` — /servicing-ops, burgundy #800020
- `kontra-ui-clone/ui/src/pages/dashboard/InspectionIntelligenceCenter.tsx` — /inspection, blue #2563eb
- `kontra-ui-clone/ui/src/pages/dashboard/HazardLossRecoveryCenter.tsx` — /hazard-recovery, amber #d97706
- `kontra-ui-clone/ui/src/pages/dashboard/ComplianceCovenantCenter.tsx` — /compliance-center, violet #7c3aed
- `kontra-ui-clone/ui/src/pages/dashboard/TokenizationExchangeCenter.tsx` — /exchange, emerald #059669
- `kontra-ui-clone/ui/src/pages/dashboard/AdminPolicyCommandCenter.tsx` — /policy-command, red #dc2626

### Updated Files
- `kontra-ui-clone/api/index.js` — phase8CommandCentersRouter mounted at /api/cc
- `kontra-ui-clone/ui/src/pages/SaasDashboard.tsx` — 6 new routes + 6 imports
- `kontra-ui-clone/ui/src/routes.jsx` — 6 nav entries (BuildingOfficeIcon, MagnifyingGlassIcon, BoltIcon, DocumentMagnifyingGlassIcon, ChartPieIcon, WrenchScrewdriverIcon)
