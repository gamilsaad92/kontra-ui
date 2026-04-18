# Overview

This project is a pnpm workspace monorepo using TypeScript, focused on developing the Kontra Platform, a full-stack loan servicing workspace for multifamily/CRE loans. The platform aims to be an AI-native headless servicing and tokenization operating system for enterprise real estate finance, with a business vision of achieving significant annual recurring revenue and transaction fees.

The core capabilities include:
- A structured workflow engine with a canonical data architecture and headless API.
- Comprehensive role-based access control and multi-tenancy.
- Tokenization of loans on the Base blockchain, focusing on minting, burning, transferring, and tracking ownership of ERC-20 tokens per pool.
- A dynamic policy engine for rule evaluation and regulatory compliance.
- An integration and legacy modernization layer featuring document intelligence (OCR, structured extraction) and adapters for various legacy systems.
- A headless enterprise interoperability layer providing LLM routing, an event bus with webhook dispatch, and a plugin connector registry for third-party integrations.
- A tokenization execution layer with a readiness agent, ERC-1400 token registry, stablecoin payment reconciliation, and investor governance features.
- A redesigned UI around six operational command centers for different aspects of loan servicing.

## User Preferences

- **Communication**: Use simple, clear language.
- **Coding Style**: Prefer functional programming where appropriate.
- **Workflow**: Emphasize iterative development.
- **Interaction**: Ask for confirmation before making major changes.
- **Explanations**: Provide detailed explanations for complex logic or decisions.
- **File System**: Do not make changes to the `Z` folder.
- **File System**: Do not make changes to the `Y` file.

## System Architecture

The project is structured as a pnpm monorepo with separate packages for deployable applications (`artifacts/`) and shared libraries (`lib/`). Each package manages its own dependencies and utilizes TypeScript for type safety.

**Core Technologies:**
- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **TypeScript**: 5.9
- **API Framework**: Express 5
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod (v4) with `drizzle-zod`
- **API Codegen**: Orval (from OpenAPI spec)
- **Build Tool**: esbuild (for CJS bundles)

**Monorepo Structure & TypeScript Configuration:**
- `tsconfig.base.json` provides shared TS options (`composite: true`).
- Root `tsconfig.json` references all packages, enabling full dependency graph type checking (`tsc --build --emitDeclarationOnly`).
- Project references are used to manage inter-package dependencies and build order.

**UI/UX Decisions:**
- **Main Application**: `kontra-ui-clone/` uses React + Vite + TailwindCSS.
- **Color Schemes**: Distinct color palettes for different portals (Lender: burgundy, Servicer: amber, Investor: violet, Borrower: emerald).
- **Navigation**: Multi-portal selection page (`/select-portal`) and role-based routing.
- **Command Centers**: A consistent `CommandCenterShell.tsx` component is used across six operational command centers, featuring KPI bars, live workflow queues, agent outputs, pending approvals, and exception handling. This shell polls data every 30 seconds and provides interactive elements like status pills, action buttons, and toast notifications.

**Technical Implementations & Feature Specifications:**

- **Authentication & Multi-tenancy**:
    - Supabase is used for user authentication.
    - An `OrgProvider` bootstraps organization context after authentication.
    - `AuthedOrgProvider` ensures session access for routes.
    - Mobile authentication uses Supabase via an API proxy, with sessions persisted in AsyncStorage.
- **Role-Based Access Control (RBAC)**:
    - A two-layer guard system (`RequireAuth`, `RequireRole`) manages access to portals.
    - Cross-portal access is silently blocked and unauthorized users are redirected.
- **Tokenization (ERC-20 Pool Token Flow)**:
    - One ERC-20 token per pool on Base.
    - Blockchain handles only mint/burn/transfer/ownership tracking; financial logic remains off-chain.
    - Key processes include pool creation, adding loans, tokenization (setting symbol, supply), and assigning allocations to whitelisted investor wallets.
    - Token metadata is stored in `pools.data` JSONB.
    - No wallet connect required in the UI; contract addresses are manually entered post-deployment.
- **Phase 1: Enterprise Core (Workflow Engine)**:
    - **Canonical Data Architecture**: 11 new entity tables (`borrowers`, `properties`, `deficiencies`, etc.).
    - **Workflow Template Library**: 6 machine-readable templates with triggers, steps, and SLAs.
    - **Headless API Endpoints**: For listing templates, launching workflows, managing approvals, and trigger events.
    - **Workflow Engine UI**: A full operational OS with tabs for instances (Kanban), templates, approvals, audit log, and API/webhooks.
- **Phase 3: Dynamic Policy Engine**:
    - A 3-tier rule evaluation system (Org override → Published DB rule → Hardcoded fallback).
    - Logs every evaluation to `kontra_rule_audit_log`.
    - Extended DB schema with tables for `kontra_rule_overrides` and `kontra_agent_rule_dependencies`.
    - Includes 38 seeded canonical regulatory rules across various categories.
- **Phase 4: Integration & Legacy Modernization Layer**:
    - **Document Intelligence**: OCR + structured extraction engine using GPT-4o-mini with confidence scoring, supporting 11 typed extraction schemas.
    - **Legacy Adapters**: 10 source system adapters (FICS, Yardi, etc.) to normalize raw data into a canonical Kontra schema.
    - **Integration Hub API**: Endpoints for document classification, extraction, ingestion, email parsing, CSV preview, and job management.
    - **Integration Hub UI**: Provides document upload, adapter management, email parser, and job queue monitoring.
- **Phase 5: Headless Enterprise Interoperability Layer**:
    - **Model Router**: External LLM routing engine supporting 5 providers (OpenAI, Anthropic, Bedrock, Ollama) with per-task priority chains and per-org config overrides. Includes auditing for latency and cost.
    - **Event Bus**: In-process EventEmitter and outbound webhook dispatcher with HMAC-SHA256 signatures and retry logic. Supports 20+ canonical event types.
    - **Plugin Connector**: Registry for 10 built-in connectors (Slack, Salesforce, Jira, etc.) with a standard `execute()` interface.
    - **Headless API (`/api/v1`)**: A versioned REST API providing endpoints for LLM completion, model configuration, webhooks (CRUD), event management, plugin installation/execution, and API key management.
    - **Enterprise API Console UI**: A 6-tab interface for managing model routing, webhooks, plugins, API keys, and exploring the OpenAPI specification.
- **Phase 6: Tokenization Execution Layer**:
    - **Tokenization Readiness Agent**: Assesses loan readiness across 5 dimensions (Data Completeness, Servicing History, Compliance, Covenant Status, Legal Documents) with scoring, blocking/conditional issues, and recommendations.
    - **ERC-1400 Token Registry**: Manages token packages, investor wallet whitelisting (KYC/AML/OFAC), transfer eligibility checks (EIP-1066 status codes), hold period enforcement, stablecoin payment reconciliation, and secondary market order books.
    - **Investor Governance**: Supports various proposal types (maturity extension, rate modification) with weighted voting and quorum tracking.
    - **Tokenization Platform UI**: A 7-tab interface for readiness assessment, token registry, investor whitelisting, transfer eligibility, payment reconciliation, secondary market, and investor governance.
- **Phase 8: Enterprise Command Centers**:
    - Redesigned UI around 6 operational command centers (Servicing, Inspection, Hazard Loss, Compliance, Tokenization Exchange, Admin Policy).
    - Each center provides KPIs, live workflow queues, agent outputs, pending approvals, SLA breaches, and an exception queue.

## External Dependencies

- **Database**: PostgreSQL (managed by Replit for development, Supabase for `kontra-ui-clone/api`).
- **ORM**: Drizzle ORM.
- **Cloud Provider**: Supabase (for `kontra-ui-clone/api` and authentication).
- **Frontend Hosting**: Vercel (`kontraplatform.com`).
- **Backend Hosting**: Render (`https://kontra-api.onrender.com`).
- **OpenAPI Codegen**: Orval.
- **Validation**: Zod.
- **LLM Providers (via Model Router)**:
    - OpenAI (gpt-4o-mini)
    - Azure OpenAI
    - Anthropic (claude-3-haiku)
    - AWS Bedrock (claude-3-haiku)
    - Ollama (llama3.2:3b)
- **Document Intelligence**: GPT-4o-mini (via OpenAI API, with demo mode if key is unavailable).
- **Legacy System Adapters**: Integrates with FICS, Situs/AMC, Yardi, MRI, Trepp/RiskMetrics, and generic data formats (spreadsheet/CSV, email/fax, inspection vendor, insurance ACORD, reserve XML).
- **Plugins (via Plugin Connector)**: Slack, Salesforce, Jira, ServiceNow, Microsoft Teams, HubSpot, DocuSign, SendGrid, PagerDuty, Fivetran.
- **Blockchain**: Base (for ERC-20 tokenization).
- **Stablecoins**: USDC, USDT, DAI, PYUSD, EURC.