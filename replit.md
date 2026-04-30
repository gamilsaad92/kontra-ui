# Overview

This project is a pnpm workspace monorepo using TypeScript, focused on building Kontra Platform, a full-stack multifamily/CRE loan servicing platform. The vision for Kontra is to be an AI-native headless servicing and tokenization OS for enterprise real estate finance, aiming for substantial annual recurring revenue and transaction fees.

The platform is structured around several key applications and shared libraries:
- **`artifacts/api-server`**: An Express.js API server.
- **`kontra-ui-clone/`**: The main application comprising a React + Vite frontend and an Express backend, designed to handle loan servicing, workflow management, policy enforcement, data integration, and blockchain-based tokenization.
- **Shared Libraries (`lib/`)**: Contains reusable components like OpenAPI specifications, generated API clients, Zod schemas, and Drizzle ORM database configurations.

Key capabilities include:
- A comprehensive loan servicing workspace with multi-tenancy and role-based access control (RBAC).
- A robust workflow engine with canonical data architecture and headless API endpoints for managing various loan-related processes.
- A dynamic policy engine for evaluating and enforcing regulatory and internal rules.
- An integration and legacy modernization layer featuring document intelligence (OCR, structured extraction), adapters for various source systems, and an email parsing capability.
- A headless enterprise interoperability layer offering LLM routing, an event bus with webhook dispatch, and a plugin connector registry for third-party services.
- A tokenization execution layer enabling the creation, management, and transfer of ERC-1400 tokens on the Base blockchain, complete with readiness assessment, investor whitelisting, payment reconciliation, and a secondary market.
- Enterprise Command Centers providing specialized operational dashboards for servicing, inspections, hazard loss, compliance, tokenization, and administration.

## User Preferences

- I prefer clear, concise explanations focusing on functionality and impact rather than verbose technical details.
- When proposing code changes, please outline the high-level approach first and ask for approval before implementing.
- I value iterative development; break down larger tasks into smaller, manageable steps.
- Ensure all new features are accompanied by relevant API endpoints and UI components where applicable.
- Do not make changes to the `artifacts/kontra-mobile` folder.
- Do not make changes to the `artifacts/kontra-ui` folder.
- Do not make changes to the `lib/api-client-react` folder.
- Do not make changes to the `lib/api-zod` folder.

## System Architecture

The project is a pnpm workspace monorepo utilizing Node.js 24 and TypeScript 5.9.

**Core Technologies:**
- **Monorepo Tool**: pnpm workspaces
- **Package Manager**: pnpm
- **API Framework**: Express 5
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API Codegen**: Orval (from OpenAPI spec)
- **Build Tool**: esbuild (CJS bundle)
- **Frontend**: React, Vite, TailwindCSS
- **Mobile**: SwiftUI (for iOS app, external to this monorepo)

**Monorepo Structure and TypeScript Configuration:**
- Each package manages its own dependencies.
- `tsconfig.base.json` sets `composite: true` for all packages, and the root `tsconfig.json` lists all packages as project references, ensuring correct cross-package type-checking and build order.
- `tsc --build --emitDeclarationOnly` is used for type-checking, emitting only `.d.ts` files, with actual JS bundling handled by esbuild.

**UI/UX Decisions (Kontra UI):**
- Features a multi-portal design with distinct color schemes for Lender, Servicer, Investor, and Borrower portals.
- Role-Based Access Control (RBAC) implemented with `RequireAuth` and `RequireRole` guards, redirecting unauthorized users.
- Workflow Engine UI presents a kanban board, template management, approval queues, and audit logs.
- Policy Engine UI provides a Regulatory Intelligence Hub with stats, rule categories, an evaluator, and an audit feed.
- Integration Hub UI offers document intelligence, adapter management, email parsing, and a job queue.
- Enterprise API Console provides a comprehensive interface for model routing, webhooks, plugins, API key management, OpenAPI exploration, and SSE live streams.
- Tokenization Platform includes a readiness agent, token registry, investor whitelist, transfer eligibility checks, payment reconciliation, secondary market, and investor governance.
- Enterprise Command Centers unify operational views across different domains (servicing, inspection, hazard, compliance, tokenization, admin) into a consistent UI shell with KPIs, workflow queues, and agent outputs.

**Technical Implementations & Feature Specifications:**

- **Authentication & Multi-tenancy**: Supabase-backed authentication with JWTs, org context bootstrapping, and integer org IDs converted to UUIDs for consistency.
- **Tokenization (ERC-20 & ERC-1400)**: Simplified ERC-20 pool token flow on Base (mint/burn/transfer/track ownership only, financial logic off-chain). ERC-1400 token registry for fractionalized real estate assets with whitelisting, KYC/AML checks, transfer eligibility, and governance.
- **Canonical Data Architecture**: Introduced 11 new entity tables in `kontra-ui-clone/api/schema-phase1-canonical.sql` for structured workflow management.
- **Workflow Engine**: 6 machine-readable workflow templates with triggers, steps, and SLAs. Headless API endpoints for template listing, workflow launching, and approval queues.
- **Dynamic Policy Engine**: 3-tier rule evaluation (`policyEngine.js`) (Org override → Published DB rule → Hardcoded fallback) with 28 canonical rules and audit logging.
- **Document Intelligence**: OCR and structured extraction engine (`documentIntelligence.js`) using `gpt-4o-mini` with 11 typed extraction schemas.
- **Legacy Adapters**: 10 source system adapters (`legacyAdapters.js`) for normalizing raw data into Kontra's canonical schema.
- **Headless Enterprise Interoperability Layer**:
    - **Model Router (`modelRouter.js`)**: LLM routing engine supporting 5 providers (OpenAI, Azure, Anthropic, Bedrock, Ollama) with per-task priority chains, cost estimates, and fallback.
    - **Event Bus (`eventBus.js`)**: In-process EventEmitter and outbound webhook dispatcher with HMAC-SHA256 signatures and retry mechanisms.
    - **Plugin Connector (`pluginConnector.js`)**: Registry for 10 built-in connectors (Slack, Salesforce, Jira, etc.) with a standard `execute()` interface.
    - **Versioned API (`headlessApi.js`)**: `/api/v1` enterprise REST API for LLM completion, webhooks, events, plugins, and API key management.
- **Command Centers**: Unified dashboard architecture, driven by data factories, providing operational oversight and action capabilities for various business functions.

## External Dependencies

- **Supabase**: Backend-as-a-Service for PostgreSQL database, authentication, and RLS.
- **OpenAI API**: Used for document classification and structured data extraction (`gpt-4o-mini`).
- **Azure OpenAI**: Alternative LLM provider option.
- **Anthropic**: Alternative LLM provider option (Claude-3-Haiku).
- **AWS Bedrock**: Alternative LLM provider option (Claude-3-Haiku).
- **Ollama**: Local LLM provider option.
- **Render**: Deployment platform for the production API.
- **Vercel**: Deployment platform for the production frontend (`kontraplatform.com`).
- **Slack**: Plugin connector.
- **Salesforce**: Plugin connector.
- **Jira**: Plugin connector.
- **ServiceNow**: Plugin connector.
- **Microsoft Teams**: Plugin connector.
- **HubSpot**: Plugin connector.
- **DocuSign**: Plugin connector.
- **SendGrid**: Plugin connector.
- **PagerDuty**: Plugin connector.
- **Fivetran**: Plugin connector.
- **Base Blockchain**: For ERC-20 and ERC-1400 token operations.
- **USDC, USDT, DAI, PYUSD, EURC**: Stablecoins supported for payment reconciliation.