import React from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    content: "By accessing or using Kontra (kontraplatform.com), you agree to be bound by these Terms of Service. If you are using Kontra on behalf of a company, you represent that you have the authority to bind that company. If you do not agree to these terms, do not use the platform.",
  },
  {
    title: "2. What Kontra Provides",
    content: "Kontra is a commercial real estate operating platform that provides: (a) a public marketplace for browsing CRE properties and service providers; (b) an authenticated workspace for managing property documents, inspections, compliance, and financial data; (c) AI-powered document analysis tools for inspection reports, insurance policies, and financial statements. The AI analysis tools are provided as informational outputs only and do not constitute professional legal, financial, insurance, or engineering advice.",
  },
  {
    title: "3. Account Registration",
    content: "You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. Notify us immediately at security@kontraplatform.com if you suspect unauthorized access. We may suspend accounts that violate these terms or that we reasonably believe are being used fraudulently.",
  },
  {
    title: "4. Acceptable Use",
    content: "You agree not to: (a) upload documents you do not own or have authorization to process; (b) use the platform to process personally identifiable information of third parties without their consent; (c) attempt to reverse-engineer, scrape, or extract data from the platform in bulk; (d) use the AI tools to generate fraudulent property reports or misrepresent property conditions; (e) interfere with the operation of the platform or other users' access; (f) use the platform for any illegal purpose. Violation of these terms may result in immediate account termination.",
  },
  {
    title: "5. Your Content",
    content: "You retain ownership of all documents and data you upload to Kontra. By uploading content, you grant Kontra a limited, non-exclusive license to process that content solely to provide the services (document analysis, storage, display within your workspace). We do not claim ownership of your property data, documents, or analysis results. You are responsible for ensuring you have the rights to upload the content you provide.",
  },
  {
    title: "6. AI Analysis Disclaimer",
    content: "Kontra's AI document analysis tools are powered by large language models and are designed to assist — not replace — professional judgment. Analysis results: (a) may contain errors or omissions; (b) should not be relied upon as the sole basis for financial, legal, or operational decisions; (c) do not constitute a professional inspection, appraisal, legal opinion, or insurance assessment. Always verify AI-generated findings with qualified professionals before acting on them. Kontra disclaims liability for decisions made based solely on AI output.",
  },
  {
    title: "7. Subscription and Billing",
    content: "Free tier features are available without payment. Paid plans are billed monthly or annually as selected at signup. Subscriptions auto-renew unless cancelled before the renewal date. Refunds are available within 7 days of a new subscription period if you have not used the paid features during that period. To cancel, go to Account Settings → Billing → Cancel Subscription. We reserve the right to change pricing with 30 days' notice to existing subscribers.",
  },
  {
    title: "8. Intellectual Property",
    content: "The Kontra platform, brand, design, software, and proprietary AI models are owned by Kontra Platform, Inc. and protected by applicable intellectual property laws. You may not copy, modify, or distribute any part of the platform without our written consent. These terms do not grant you any rights to our trademarks or trade names.",
  },
  {
    title: "9. Limitation of Liability",
    content: "To the maximum extent permitted by law, Kontra's total liability to you for any claims arising from these terms or your use of the platform shall not exceed the greater of: (a) $100 USD, or (b) the amounts you paid to Kontra in the 12 months preceding the claim. Kontra is not liable for indirect, incidental, consequential, or punitive damages, including lost profits or data loss, even if advised of the possibility of such damages.",
  },
  {
    title: "10. Indemnification",
    content: "You agree to defend and indemnify Kontra, its officers, directors, employees, and agents from and against any claims, damages, or expenses (including legal fees) arising from: (a) your use of the platform; (b) your violation of these terms; (c) your violation of any third party's rights; or (d) any content you upload that infringes third-party rights.",
  },
  {
    title: "11. Termination",
    content: "You may terminate your account at any time by contacting support@kontraplatform.com. We may suspend or terminate your account for material breach of these terms, with or without notice depending on severity. Upon termination, your access to the workspace ceases immediately. We will retain your data for 30 days following termination, during which you may request an export. After 30 days, all data is permanently deleted.",
  },
  {
    title: "12. Governing Law and Disputes",
    content: "These terms are governed by the laws of the State of New York, without regard to conflict of law principles. Any dispute arising from these terms or your use of Kontra shall be resolved by binding arbitration administered by JAMS under its Commercial Arbitration Rules, with proceedings conducted in New York, NY. Class action waiver: you agree to resolve disputes individually, not as part of a class action.",
  },
  {
    title: "13. Changes to Terms",
    content: "We may update these terms at any time. Material changes will be communicated by email and in-app notification at least 14 days before they take effect. Continued use of the platform after the effective date constitutes acceptance of the updated terms.",
  },
];

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Terms of Service</h1>
          <p className="text-sm text-gray-500">Effective date: June 1, 2026 · Last updated: June 8, 2026</p>
          <p className="text-sm text-gray-600 mt-4 leading-relaxed">
            These Terms of Service govern your use of Kontra's platform and services. Please read them carefully.
          </p>
        </div>

        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <div key={section.title} className="border-b border-gray-100 pb-8 last:border-0">
              <h2 className="text-sm font-bold text-gray-900 mb-3">{section.title}</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 p-5 rounded-xl bg-gray-50 border border-gray-200">
          <p className="text-sm font-semibold text-gray-900 mb-1">Questions About These Terms</p>
          <p className="text-sm text-gray-600">
            Email <a href="mailto:legal@kontraplatform.com" className="underline hover:text-gray-900">legal@kontraplatform.com</a>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Kontra Platform, Inc. · 1 World Trade Center · New York, NY 10007
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
