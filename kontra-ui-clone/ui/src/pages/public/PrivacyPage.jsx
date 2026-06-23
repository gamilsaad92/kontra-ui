import React from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const SECTIONS = [
  {
    title: "Information We Collect",
    content: [
      "**Deal room details**: When you create a deal room, we collect your name, email address, property name, property type, address, deal amount, and deal type.",
      "**Uploaded documents**: Inspection reports, insurance certificates, financial statements, and other documents uploaded by deal room parties (owner, lender, inspector, insurer, attorney). These files are stored in encrypted cloud storage for the duration of the deal and for a minimum of 7 years following loan maturity — see Document Retention below.",
      "**AI analysis results**: Structured data extracted from uploaded documents (e.g. NOI, DSCR, condition score, coverage gaps) is stored in our database alongside the property record.",
      "**Payment data**: When you purchase a deal room, Stripe processes your payment. We receive a payment confirmation and your email — we never see or store your card number.",
      "**Usage data**: Pages visited, features used, and actions taken within the platform, used to improve the product.",
      "**Device and technical data**: IP address, browser type, and access times — collected automatically.",
    ],
  },
  {
    title: "How We Use Your Information",
    content: [
      "**Provide the service**: Run AI document analysis, maintain deal room records, and enable multi-party collaboration on CRE transactions.",
      "**Document retrieval**: Store original uploaded documents so they remain accessible to deal room owners throughout the loan lifecycle and any subsequent tokenization process — eliminating the need to re-request documents from parties.",
      "**Improve the product**: Understand how features are used to prioritize improvements. We never use your specific property data or documents to train AI models.",
      "**Communicate with you**: Send transactional emails (deal room activation, document upload notifications) and, with your consent, product updates.",
      "**Security and fraud prevention**: Detect and prevent unauthorized access, abuse, and fraud.",
      "**Legal and regulatory compliance**: Comply with applicable securities laws, IRS record-keeping requirements, and respond to lawful requests from authorities.",
    ],
  },
  {
    title: "Document Storage and Retention",
    content: [
      "**Where documents are stored**: Uploaded files are stored in Supabase Storage (AWS S3-compatible infrastructure, AES-256 encryption at rest, TLS 1.3 in transit). Documents are never publicly accessible — access requires a time-limited signed URL (1-hour expiry) generated on demand.",
      "**Who can access documents**: Only the deal room owner (via their owner URL) and Kontra's service infrastructure can generate download links. Third-party parties (lender, inspector, etc.) who uploaded documents do not retain access after their session.",
      "**Retention period**: Documents are retained for the life of the associated deal room, plus a minimum of 7 years following loan maturity, consistent with IRS financial record requirements (26 U.S.C. § 6501) and SEC record-keeping rules (Rule 17a-4). This retention period supports downstream loan tokenization and regulatory compliance.",
      "**Deletion**: Deal room owners may request deletion of all documents associated with their property by emailing privacy@kontraplatform.com. Deletion requests are processed within 30 days. Note that documents subject to active regulatory hold or litigation cannot be deleted until the hold is lifted.",
      "**OpenAI processing**: Document text is extracted and sent to OpenAI's API (GPT-4o) for analysis. This processing occurs at upload time only. OpenAI's API terms (openai.com/policies/usage-policies) prohibit training models on API inputs. OpenAI does not retain document content after the API call completes.",
    ],
  },
  {
    title: "Data Security",
    content: [
      "All data is encrypted in transit (TLS 1.3) and at rest (AES-256).",
      "Database records are protected by row-level security — each deal room's data is isolated by property ID.",
      "Document download links are signed and expire after 1 hour — sharing a link does not grant permanent access.",
      "We do not sell your data to third parties. Ever.",
      "In the event of a data breach affecting personal information, we will notify affected users within 72 hours as required by applicable law.",
    ],
  },
  {
    title: "Third-Party Services",
    content: [
      "**OpenAI**: Document text is sent to OpenAI's API for AI analysis at upload time. OpenAI does not train on API data. See openai.com/policies.",
      "**Supabase**: Database, authentication, and file storage provider running on AWS. See supabase.com/privacy.",
      "**Stripe**: Payment processing. We never store card information. See stripe.com/privacy.",
      "**Render**: API server hosting. See render.com/privacy.",
      "**Resend**: Transactional email delivery (deal room notifications). See resend.com/privacy.",
      "We do not use advertising networks, data brokers, or behavioral tracking pixels.",
    ],
  },
  {
    title: "Your Rights",
    content: [
      "**Access**: Request a copy of all data and documents we hold associated with your deal room.",
      "**Correction**: Contact us to correct inaccurate deal room records.",
      "**Deletion**: Request deletion of all documents and data associated with your deal room. Processed within 30 days, subject to regulatory retention requirements.",
      "**Portability**: Request your deal analysis data in JSON format.",
      "**Opt-out**: Unsubscribe from non-transactional emails at any time. Upload notification emails cannot be disabled while a deal room is active.",
      "To exercise any of these rights, email privacy@kontraplatform.com with your deal room property ID and the email used at checkout.",
    ],
  },
  {
    title: "Cookies",
    content: [
      "We use essential cookies only: session tokens required for the platform to function.",
      "We do not use advertising cookies, tracking pixels, or third-party analytics cookies.",
    ],
  },
  {
    title: "CCPA Notice (California Residents)",
    content: [
      "If you are a California resident, you have the right to know what personal information we collect, request deletion, and opt out of sale (we do not sell personal information).",
      "Categories of personal information collected: identifiers (name, email), commercial information (deal terms, payment records), and documents you upload.",
      "To submit a CCPA request, email privacy@kontraplatform.com.",
    ],
  },
  {
    title: "Changes to This Policy",
    content: [
      "We will notify deal room owners by email at least 14 days before material changes to this policy take effect.",
      "The effective date at the top of this page reflects the most recent update.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <Link to="/" className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1.5 mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Kontra
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Effective date: June 22, 2026 · Last updated: June 22, 2026</p>
          <p className="text-sm text-gray-600 mt-4 leading-relaxed">
            Kontra Platform, Inc. ("Kontra", "we", "us") operates kontraplatform.com and the Kontra CRE deal room platform.
            This policy explains what data we collect, how we store it, how long we keep it, and your rights.
          </p>
        </div>

        {/* Document storage highlight box */}
        <div className="mb-10 p-5 rounded-xl border border-gray-200 bg-gray-50">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Key facts about document storage</p>
          <div className="space-y-2">
            {[
              "📄  Uploaded documents are stored encrypted in Supabase Storage (AWS), not discarded after analysis.",
              "🤖  Document text is processed by OpenAI's API at upload time. OpenAI does not retain or train on this data.",
              "🔒  Downloads require a signed link that expires in 1 hour — no permanent public access.",
              "📅  Documents are kept for the life of the deal + minimum 7 years after loan maturity (IRS & SEC compliance).",
              "🗑️  Owners can request full deletion by emailing privacy@kontraplatform.com.",
            ].map((fact, i) => (
              <p key={i} className="text-sm text-gray-600">{fact}</p>
            ))}
          </div>
        </div>

        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-base font-bold text-gray-900 mb-4">{section.title}</h2>
              <ul className="space-y-3">
                {section.content.map((item, i) => {
                  const parts = item.split(/\*\*(.*?)\*\*/g);
                  return (
                    <li key={i} className="flex gap-2.5 text-sm text-gray-600 leading-relaxed">
                      <span className="text-gray-300 mt-0.5 shrink-0">→</span>
                      <span>
                        {parts.map((p, j) =>
                          j % 2 === 1 ? <strong key={j} className="text-gray-900">{p}</strong> : p
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 p-5 rounded-xl bg-gray-50 border border-gray-200">
          <p className="text-sm font-semibold text-gray-900 mb-1">Contact Us</p>
          <p className="text-sm text-gray-600">
            Privacy requests and questions:{" "}
            <a href="mailto:privacy@kontraplatform.com" className="underline hover:text-gray-900">
              privacy@kontraplatform.com
            </a>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Kontra Platform, Inc. · 1 World Trade Center · New York, NY 10007
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
