import React from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const SECTIONS = [
  {
    title: "Information We Collect",
    content: [
      "**Workspace and transaction details**: When you create a workspace, we collect your name, email address, workspace name, transaction type, location, deal amount, and other details you provide during setup.",
      "**Uploaded documents**: Financial statements, legal agreements, diligence materials, and other documents uploaded by workspace participants. These files are stored in encrypted cloud storage for the duration of the workspace — see Retention below.",
      "**Third-party information in documents**: Workspace owners and participants may upload documents containing personal information about individuals who are not direct Kontra users — such as employees, customers, tenants, guarantors, or counterparties. Those users are responsible for providing required notices and establishing a lawful basis for that disclosure.",
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
    title: "Service Providers and Data Sharing",
    content: [
      "**OpenAI**: Document text is sent to OpenAI's API (GPT-4o / GPT-4o-mini) for analysis. By default, OpenAI does not use API inputs or outputs to train its models. Depending on the API configuration and endpoint used, OpenAI may retain certain inputs and outputs for up to 30 days for abuse monitoring and legal compliance. Kontra will update this disclosure if it obtains approved Zero Data Retention status with OpenAI. See openai.com/policies.",
      "**Supabase**: Database, authentication, and file storage provider running on AWS. Supabase maintains SOC 2 and ISO 27001 certifications covering its own infrastructure. See supabase.com/privacy.",
      "**Stripe**: Payment processing. We never store card information. See stripe.com/privacy.",
      "**Render**: API server hosting. Render maintains SOC 2 Type 2 controls covering its own infrastructure. See render.com/privacy.",
      "**Resend**: Transactional email delivery. See resend.com/privacy.",
      "Provider certifications listed above apply to each provider's own infrastructure and do not mean that Kontra itself holds those certifications.",
      "We do not sell personal information or share it with advertising networks, data brokers, or behavioral tracking services.",
      "**Legally compelled disclosure**: We may disclose information when required by law, court order, or government authority.",
      "**Business transfer**: If Kontra's business or assets are acquired, merged, or transferred, user data may be included among the transferred assets. We will provide notice before your information is transferred and becomes subject to a different privacy policy.",
    ],
  },
  {
    title: "Document Storage and Retention",
    content: [
      "**Where documents are stored**: Uploaded files are stored in Supabase Storage (AWS S3-compatible infrastructure). Documents are not publicly accessible — access requires a time-limited signed URL generated on demand.",
      "**Who can access documents**: Production document access is restricted to authorized personnel with a legitimate operational need, requires authenticated access, and is logged. Third-party participants who uploaded documents do not retain access after their session.",
      "**Retention period**: Workspace data is retained for the duration of the active workspace. Following workspace closure or account termination, data is retained for up to 30 days to allow export requests, after which it is deleted. Deleted data may remain in encrypted backups for a limited period until those backups are overwritten in the ordinary course.",
      "**Longer retention by agreement**: Customers requiring longer retention for legal, contractual, or compliance reasons may contact support@kontraplatform.com — subject to a written agreement.",
      "**Deletion requests**: Workspace owners may request deletion of all documents and data by emailing privacy@kontraplatform.com. An early deletion request closes workspace access, begins deletion processing, and is irreversible once completed — export any records you need before submitting. Requests are processed within 30 days. Data subject to an active legal hold cannot be deleted until the hold is lifted. Deleted data may remain in encrypted backups until those backups are overwritten in the ordinary course.",
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
      "Kontra's public web and API connections use modern TLS encryption. Infrastructure-level connections may use TLS 1.2 or higher depending on provider configuration.",
      "Kontra's infrastructure providers encrypt stored data at rest using industry-standard encryption, including AES-256 where supported and configured.",
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
      "To exercise any of these rights, email privacy@kontraplatform.com with your workspace ID or workspace name and the email used at checkout.",
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
      "To the extent the CCPA/CPRA applies to Kontra, California residents may have the following rights.",
      "**Categories of personal information collected**: Identifiers (name, email, IP address); commercial information (transaction details, payment records); documents you upload; AI-extracted transaction data; usage and device data.",
      "**Sources**: Directly from you when you create a workspace or upload documents; automatically from your device; from participants you invite to your workspace.",
      "**Business purposes**: To provide and improve the platform, process payments, send transactional communications, and comply with law.",
      "**Service providers**: We disclose data to the service providers listed above (OpenAI, Supabase, Stripe, Render, Resend) for the purposes of operating the platform.",
      "**Sale or sharing**: We do not sell personal information. We do not share personal information for cross-context behavioral advertising.",
      "**Sensitive personal information**: Kontra does not intentionally request sensitive personal information (such as Social Security numbers, financial account numbers, or government ID numbers) as a standard workspace field. Sensitive information may nevertheless be contained in documents uploaded by users. Users should avoid uploading unnecessary sensitive information and must have authority and a lawful basis to provide it.",
      "**Your rights**: You have the right to know, access, correct, delete, and opt out of sale or sharing of your personal information. You also have the right to non-discrimination for exercising these rights.",
      "**Authorized agents**: An authorized agent may submit a request on your behalf by emailing privacy@kontraplatform.com with written authorization from you.",
      "**Identity verification**: We will verify your identity before processing access or deletion requests — typically by confirming the email address associated with the workspace.",
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
              "🗑️  Following closure, data remains available for export for up to 30 days and is then scheduled for deletion, subject to backup rotation, legal holds, and written retention agreements.",
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
