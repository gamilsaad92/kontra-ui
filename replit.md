# Overview

This project is a pnpm workspace monorepo using TypeScript, designed for a full-stack multifamily/CRE loan servicing platform called Kontra Platform. The primary application, `kontra-ui-clone/`, aims to be an AI-native headless servicing and tokenization OS for enterprise real estate finance, with a target of $40M SaaS ARR and $37.5M in transaction fees.

The platform includes a React + Vite frontend and an Express backend, leveraging PostgreSQL with Drizzle ORM. Key capabilities include:

- **Monorepo Management:** Structured with pnpm workspaces for efficient package management.
- **Data Architecture:** Implements a canonical data architecture with 11 core entity tables and 6 machine-readable workflow templates.
- **Role-Based Access Control (RBAC):** A two-layer guard system for portal access based on user roles (lender, servicer, investor, borrower).
- **Dynamic Policy Engine:** A 3-tier rule evaluation system for regulatory intelligence, supporting organization-specific overrides, published database rules, and hardcoded fallbacks.
- **Integration & Legacy Modernization:** Features document intelligence (OCR + structured extraction), legacy system adapters, and an integration hub for various data sources.
- **Headless Enterprise Interoperability:** Provides a versioned REST API (`/api/v1`) with an external LLM routing engine, an event bus for real-time notifications, and a plugin connector registry for third-party services.
- **Tokenization Execution Layer:** A comprehensive system for assessing loan readiness for tokenization, managing an ERC-1400 Token Registry, handling investor whitelisting, transfer eligibility, stablecoin payment reconciliation, secondary market order books, and governance proposals.
- **Enterprise Command Centers:** A redesigned UI centered around 6 operational command centers for servicing, inspection, hazard loss, compliance, tokenization exchange, and administration.

# User Preferences

I prefer iterative development, with a focus on delivering working features quickly and refining them based on feedback. I appreciate clear communication and detailed explanations of technical decisions, especially concerning architectural patterns and the rationale behind choosing certain technologies.

Regarding coding style, I favor clean, readable code with strong typing (TypeScript). For frontend, I prefer React with a component-based approach and functional components where appropriate. For backend, I like well-structured Express applications with clear route definitions and separation of concerns.

I prefer that you ask before making major architectural changes or introducing new core dependencies. When implementing new features, please outline the proposed changes and their impact before execution. I expect the agent to maintain the existing monorepo structure and adhere to the established build and typechecking processes.

# System Architecture

The project is structured as a pnpm workspace monorepo.

**Monorepo Structure:**
- `artifacts/`: Deployable applications (e.g., `api-server`).
- `lib/`: Shared libraries (`api-spec`, `api-client-react`, `api-zod`, `db`).
- `scripts/`: Utility scripts.

**TypeScript & Composite Projects:**
- All packages extend `tsconfig.base.json` with `composite: true`.
- Root `tsconfig.json` lists packages as project references.
- Typechecking from the root via `tsc --build --emitDeclarationOnly` to ensure correct cross-package import resolution and build order.
- `emitDeclarationOnly` ensures only `.d.ts` files are emitted, with actual JS bundling handled by esbuild.

**UI/UX Decisions (Kontra UI - `kontra-ui-clone/`):**
- **Frontend Framework:** React + Vite + TailwindCSS.
- **Portals:** The application is organized into distinct portals (`/dashboard` - Lender, `/servicer` - Servicer, `/investor` - Investor, `/borrower` - Borrower), each with a specific color scheme and role-based access.
- **Guard System:** `RequireAuth` for authentication and `RequireRole` for authorization.
- **Mobile Auth:** Handled via Supabase auth, JWT storage, and API proxy in the mobile application.
- **Command Centers:** The UI is redesigned around 6 operational command centers, sharing a `CommandCenterShell.tsx` for consistent layout, KPI display, workflow queues, and agent outputs.
- **Tokenization UI:** Features a 7-tab platform including a Readiness Agent, Token Registry, Investor Whitelist, Transfer Eligibility, Payment Reconciliation, Secondary Market, and Investor Governance.

**Technical Implementations:**
- **API Framework:** Express 5.
- **Database:** PostgreSQL with Drizzle ORM.
- **Validation:** Zod (`zod/v4`) and `drizzle-zod` for request/response validation.
- **API Codegen:** Orval generates React Query hooks and Zod schemas from an OpenAPI specification.
- **Build Tool:** esbuild for CJS bundling.
- **Auth & Multi-tenancy:** Implemented using Supabase for user authentication and managing organization contexts. All API requests enforce an `org_id` context.
- **Workflow Engine:** Features 6 machine-readable workflow templates with triggers, steps, SLAs, and typed step nodes. A dedicated UI manages workflow instances, templates, approvals, and audit logs.
- **Policy Engine:** A 3-tier rule evaluation system (`policyEngine.js`) that checks org overrides, published DB rules, and hardcoded fallback rules.
- **Integration Layer:**
    - **Document Intelligence:** Utilizes GPT-4o-mini for OCR and structured extraction with 11 typed schemas.
    - **Legacy Adapters:** 10 source system adapters (`legacyAdapters.js`) for normalizing raw data into a canonical Kontra schema.
    - **Integration Hub API:** Endpoints for classifying, extracting, ingesting, email parsing, CSV preview, and job management.
- **Headless Enterprise Interoperability Layer:**
    - **Model Router:** An external LLM routing engine supporting multiple providers (OpenAI, Azure, Anthropic, Bedrock, Ollama) with task-priority chains and per-org configuration overrides.
    - **Event Bus:** In-process EventEmitter and outbound webhook dispatcher for 20+ canonical event types, with HMAC-SHA256 signatures and exponential retry.
    - **Plugin Connector:** A registry for 10 built-in connectors (Slack, Salesforce, Jira, etc.) with a standard `execute()` interface.
    - **Enterprise API (`/api/v1`):** A versioned REST API providing access to model routing, webhooks, events, plugins, API key management, and combined statistics.
- **Tokenization Execution Layer:**
    - **Readiness Agent:** A 5-dimension assessment for loan tokenization readiness, generating a score and identifying blocking/conditional issues.
    - **Token Registry:** ERC-1400 compliant registry for managing token packages, investor whitelisting (KYC/AML/OFAC), transfer eligibility, stablecoin payment reconciliation, secondary market order books, and governance proposals.

# External Dependencies

- **Node.js:** Version 24
- **Package Manager:** pnpm
- **TypeScript:** Version 5.9
- **API Framework:** Express 5
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Validation:** Zod
- **API Codegen:** Orval (from OpenAPI spec)
- **Build Tool:** esbuild
- **Frontend Library:** React
- **Frontend Build Tool:** Vite
- **Styling Framework:** TailwindCSS
- **Authentication/Backend-as-a-Service:** Supabase (for Kontra UI clone, specifically project `jfhojgtnmcfqretrrxam`)
- **Cloud Hosting:** Render (for API deployment), Vercel (for Kontra UI frontend)
- **LLM Providers (via `modelRouter`):** OpenAI, Azure OpenAI, Anthropic, AWS Bedrock, Ollama
- **External Integration Connectors (via `pluginConnector`):** Slack, Salesforce, Jira, ServiceNow, Microsoft Teams, HubSpot, DocuSign, SendGrid, PagerDuty, Fivetran.
- **Stablecoins (for tokenization):** USDC, USDT, DAI, PYUSD, EURC.