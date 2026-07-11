import React from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const SECTIONS = [
  {
    title: "Information We Collect",
    content: [
      "**Workspace and transaction details**: When you create a workspace, we collect your name, email address, workspace name, transaction type, location, deal amount, and other details you provide during setup.",
      "**Uploaded documents**: Financial statements, legal agreements, diligence materials, and other documents uploaded by workspace participants. These files are stored in encrypted cloud storage for the duration of the workspace — see Retention below.",
      "**AI analysis results**: Structured data extracted from uploaded documents (e.g. financial metrics, condition assessments, coverage gaps) is stored in our database alongside the workspace record.",
      "**Payment data**: When you purchase a workspace, Stripe processes your payment. We receive a payment confirmation and your email — we never see or store your card number.",
      "**Usage data**: Pages visited, features used, and actions taken within the platform, used to improve the product.",
      "**Device and technical data**: IP address, browser type, and access times — collected automatically.",
    ],
  },
  {
    title: "How We Use Your Information",
    content: [
      "**Provide the service**: Run AI document analysis, maintain workspace records, and enable multi-party collaboration on transactions.",
      "**Document retrieval**: Store original uploaded documents so they remain accessible to workspace owners throughout the active workspace period.",
      "**Improve the product**: Understand how features are used to prioritize improvements. We do not use your specific transaction data or documents to train AI models.",
      "**Communicate with you**: Send transactional emails (workspace activation, document upload notifications, task updates) and, with your consent, product updates.",
      "**Security and fraud prevention**: Detect and prevent unauthorized access, abuse, and fraud.",
      "**Legal compliance**: Comply with applicable law and respond to lawful requests from authorities.",
    ],
  },
  {
    title: "AI and Third-Party Processing",
    content: [
      "**OpenAI**: Document text is sent to OpenAI's API (GPT-4o / GPT-4o-mini) for analysis. By default, OpenAI does not use API inputs or outputs to train its models. Depending on the API configuration and endpoint used, OpenAI may retain certain inputs and outputs for up to 30 days for abuse monitoring and legal compliance. Kontra will update this disclosure if it obtains approved Zero Data Retention status with OpenAI.",
      "**Supabase**: Database, authentication, and file storage provider running on AWS. See supabase.com/privacy. Supabase maintains its own SOC 2 and ISO 27001 certifications, which cover Supabase's infrastructure — not Kontra itself.",
      "**Stripe**: Payment processing. We never store card information. See stripe.com/privacy.",
      "**Render**: API server hosting. See render.com/privacy. Render maintains SOC 2 Type 2 controls covering its infrastructure.",
      "**Resend**: Transactional email delivery. See resend.com/privacy.",
      "We do not use advertising networks, data brokers, or behavioral tracking pixels. Provider certifications listed above apply to those providers' infrastructure and do not mean that Kontra itself holds those certifications.",
    ],
  },
  {
    title: "Document Storage and Retention",
    content: [
      "**Where documents are stored**: Uploaded files are stored in Supabase Storage (AWS S3-compatible infrastructure, AES-256 encryption at rest, TLS 1.3 in transit). Documents are not publicly accessible — access requires a time-limited signed URL generated on demand.",
      "**Who can access documents**: Production document access is restricted to authorized personnel with a legitimate operational need, requires authenticated access, and is logged. Third-party participants who uploaded documents do not retain access after their session.",
      "**Retention period**: Workspace data is retained for the duration of the active workspace. Following workspace termination or account deletion, data is retained for up to 30 days to allow export requests, after which it is deleted. Customers requiring longer retention for legal, contractual, or compliance reasons may contact support@kontraplatform.com — subject to a written agreement.",
      "**Deletion**: Workspace owners may request deletion of all documents and data associated with their workspace by emailing privacy@kontraplatform.com. Requests are processed within 30 days. Data subject to an active legal hold cannot be deleted until the hold is lifted.",
    ],
  },
  {
    title: "Audit Logging",
    content: [
      "**What is logged**: Material workspace actions — including AI-generated recommendations, task creation, task status changes, document uploads, AI analysis results, and approvals — are recorded in an application audit log with a timestamp and attributed party.",
      "**Purpose**: Audit logs allow workspace owners to review activity within their workspace and support compliance or legal inquiries.",
      "**Retention**: Audit logs are retained for the duration of the workspace plus the 30-day post-termination window, or longer if required by applicable law or a written agreement.",
      "**Access**: Workspace owners may request an export of their workspace audit log by emailing privacy@kontraplatform.com.",
    ],
  },
  {
    title: "Data Security",
    content: [
      "All data is encrypted in transit (TLS 1.3) and at rest (AES-256).",
      "Row-level security and application-level authorization controls are designed to prevent unauthorized cross-workspace data access.",
      "Document download links are signed and expire after 1 hour — sharing a link does not grant permanent access.",
      "We do not sell your data to third parties.",
      "In the event of a data breach affecting personal information, Kontra will provide legally required notices without unreasonable delay and within any time period required by applicable law.",
    ],
  },
  {
    title: "Your Rights",
    content: [
      "**Access**: Request a copy of all data and documents we hold associated with your workspace.",
      "**Correction**: Contact us to correct inaccurate workspace records.",
      "**Deletion**: Request deletion of all documents and data associated with your workspace. Processed within 30 days, subject to legal holds or contractual retention agreements.",
      "**Portability**: Request your workspace analysis data in JSON format.",
      "**Audit log export**: Request an export of all logged actions in your workspace.",
      "**Opt-out**: Unsubscribe from non-transactional emails at any time.",
      "To exercise any of these rights, email privacy@kontraplatform.com with your workspace property ID and the email used at checkout.",
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
      "Categories of personal information collected: identifiers (name, email), commercial information (transaction terms, payment records), and documents you upload.",
      "To submit a CCPA request, email privacy@kontraplatform.com.",
    ],
  },
  {
    title: "Changes to This Policy",
    content: [
      "We will notify workspace owners by email at least 14 days before material changes to this policy take effect.",
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
          <p className="text-sm text-gray-500">Effective date: June 22, 2026 · Last updated: July 11, 2026</p>
          <p className="text-sm text-gray-600 mt-4 leading-relaxed">
            Kontra ("we", "us") operates kontraplatform.com and the Kontra deal room platform.
            This policy explains what data we collect, how we store it, how long we keep it, and your rights.
          </p>
        </div>

        <div className="mb-10 p-5 rounded-xl border border-gray-200 bg-gray-50">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Key facts</p>
          <div className="space-y-2">
            {[
              "📄  Uploaded documents are stored encrypted in Supabase Storage (AWS) for the duration of your active workspace.",
              "🤖  Document text is sent to OpenAI's API at analysis time. OpenAI does not train on API data by default; inputs may be retained up to 30 days for abuse monitoring.",
              "🔒  Document download links are signed and expire after 1 hour.",
              "📋  Material AI recommendations, task actions, and approvals are recorded in a workspace audit log.",
              "🗑️  Workspace owners can request deletion by emailing privacy@kontraplatform.com.",
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
        </div>
      </div>
    </PublicLayout>
  );
}
