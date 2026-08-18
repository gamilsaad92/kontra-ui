---
name: Kontra Product Boundary
description: Legal and regulatory constraints on what Kontra may and may not build — coordination/preparation only, never execution or issuance.
---

## The boundary

> Kontra coordinates, organizes, verifies, and prepares.
> Kontra does NOT issue, sell, recommend, exchange, custody, or settle digital assets.

## Kontra may provide
- Transaction workspaces, document collection and organization
- Due-diligence checklists, AI extraction and document analysis
- Cross-document consistency checks, participant coordination
- Task/deadline/approval/stage tracking
- Identity-verification status received from third-party providers (status only, not performing it)
- Structured transaction and asset records
- Ownership and cap-table information entered by authorized users
- Readiness assessments (completion only, not legal eligibility)
- Missing-document and unresolved-risk indicators
- Audit trails and source-document citations
- Verified transaction packages
- Exportable preparation packages for external legal, compliance, issuance, custody, or settlement providers
- Neutral educational explanations of preparation requirements
- Third-party integration placeholders and referral links

## Kontra must NOT provide
- Token minting or smart-contract deployment
- Token sales or investor subscriptions
- Investor solicitation or matching
- Recommendations about whether to invest or about token price/supply/valuation/returns/offering terms
- Negotiation of securities transactions
- Order routing, trading, or secondary-market functionality
- Handling or transmitting fiat, stablecoins, cryptocurrency, or investor funds
- Custody of tokens, assets, wallets, keys, or funds
- Settlement or distributions
- Declaring an offering legally compliant or approving regulatory compliance
- Acting as official securities holder registry
- Commissions or fees based on capital raised, tokens sold, investors introduced, or transaction value

## Pricing constraint
Kontra pricing must be a fixed software fee or subscription — never tied to whether an offering closes or how much capital is raised (FINRA broker-dealer concern).

## Correct naming
- ✅ "Digital Asset Readiness" (preferred)
- ✅ "Digital Issuance Preparation" (acceptable)
- ❌ Tokenization Engine, Launch Token, Issue Tokens, Create Offering, Investor Marketplace, Token Sale, Compliance Approval

## Architecture
Transaction → Verification Support → Verified Record → Digital Asset Readiness → External Provider Handoff
NOT: Transaction → Kontra Token Issuance

## Digital Asset Readiness workflow (5 sections + export)
1. Asset Record — identity, type, ownership entity, supporting docs, valuation docs, encumbrances, verification status
2. Ownership and Governance — legal owner, beneficial owners, existing cap table, governing documents, required approvals, transfer restrictions
3. Legal Preparation — proposed jurisdiction (entered by customer/counsel), counsel assigned, legal analysis uploaded, offering docs uploaded, entity structure documented, required disclosures tracked
4. Compliance Preparation — KYC/AML/accreditation provider selected, sanctions-screening status, required policies uploaded, compliance reviewer assigned
5. Issuance Preparation — external issuance provider, external transfer agent/registry, external custodian, proposed network, proposed token structure, **draft** supply and economics

Token economics (name, ticker, supply, price, raise target) = customer-provided draft information. Must carry disclaimer label:
> "Draft information supplied by the workspace owner. Kontra does not structure, recommend, approve, issue, or sell digital assets."

## Readiness language
✅ Use: "Preparation incomplete", "Information collected", "Awaiting professional review", "Ready for external review", "Package prepared for handoff"
❌ Never: "Legally compliant", "Approved for issuance", "SEC compliant", "Cleared for sale", "Guaranteed tokenization-ready", "Authorized offering"

Readiness score = document and workflow completion ONLY, not legal eligibility.

## AI grounding
Tokenization and digital-asset questions must lead with the current Transaction Record facts and statuses, then list tokenization-specific preparation gaps, then provide clearly labeled general education. The answer must preserve optionality and avoid unsupported readiness, approval, eligibility, exemption, or regulatory claims.

**Why:** model prompts alone can still lead with generic demo or document context, so the response contract needs a deterministic factual preface before any generated explanation.

**How to apply:** derive the preface from `transaction_context.record.state` for real rooms and the equivalent fixture record for demos; treat conflicts and awaiting-confirmation values as open review items.

## Primary export action
✅ "Export Preparation Package" or "Send to External Provider"
❌ Never "Issue Token"

## Required disclosure (must appear in DA Readiness tab)
> Kontra provides software for transaction coordination, document organization, verification support, and digital-asset preparation. Kontra does not provide legal, investment, brokerage, issuance, custody, money-transmission, or regulatory services. Readiness indicators measure workspace completion and do not constitute legal approval or eligibility for issuance.

## Kontra must not
- Determine that an asset is or is not a security
- Select the legal exemption on behalf of customers
- Integrate any issuance execution until deliberately partnering with licensed providers and receiving legal approval for the exact integration model

**Why:** Securities laws (broker-dealer registration, investment adviser rules, money-transmitter obligations) apply depending on exact facts. These constraints keep Kontra clearly on the preparation/coordination side.
