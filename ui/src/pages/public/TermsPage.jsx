import React from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const SECTIONS = [
  {
    title: "1. Eligibility and Acceptance",
    content: "You must be at least 18 years old and legally capable of entering a binding contract to use Kontra. By accessing or using Kontra (kontraplatform.com), you agree to be bound by these Terms of Service. If you are using Kontra on behalf of a company, you represent that you have the authority to bind that company. If you do not agree to these terms, do not use the platform.",
  },
  {
    title: "2. What Kontra Provides",
    content: "Kontra is a secure AI workflow platform for managing transactions, due diligence, financing, acquisitions, and other collaborative business workflows. Supported workflow types include commercial real estate acquisitions, business acquisitions, fundraising processes, and other transaction types enabled by the platform. Kontra provides: (a) deal room workspaces for organizing multi-party transactions; (b) AI-powered document analysis and workflow automation tools; (c) an Operations Manager that surfaces task status, critical path analysis, and deal health assessments; (d) role-based document collection and task tracking for all parties in a transaction. All AI-generated analysis, recommendations, and assessments are provided as informational outputs only and do not constitute professional legal, financial, investment, insurance, or engineering advice.",
  },
  {
    title: "3. Not a Broker-Dealer or Investment Adviser",
    content: "Kontra is a software platform — not a broker-dealer, investment adviser, securities issuer, transfer agent, exchange, custodian, or escrow agent. Kontra does not introduce investors to issuers, arrange or facilitate securities transactions, solicit investments, negotiate deal terms on behalf of any party, or provide any service that would require registration as a broker-dealer under the Securities Exchange Act of 1934 or as an investment adviser under the Investment Advisers Act of 1940. The Fundraising workflow type is designed to help parties who have already identified each other organize documents and track workflow — it does not constitute a securities offering, private placement, or any form of regulated financial intermediation. Kontra does not charge compensation based on capital raised, investors introduced, securities sold, or transaction success. If your use case involves regulated securities activity, you should consult qualified legal counsel before using Kontra.",
  },
  {
    title: "4. Tokenization Disclaimer",
    content: "Tokenization functionality, where available, is intended to support workflow, documentation, and operational readiness. Kontra is not a broker-dealer, transfer agent, exchange, custodian, investment adviser, or securities issuer. Kontra does not issue, underwrite, trade, or custody any tokenized instrument. Any tokenization of assets must comply with applicable securities and financial regulations, which is the sole responsibility of the parties involved. You should obtain independent legal and regulatory advice before tokenizing any financial instrument. Until a tokenization feature is described as live and production-ready in the platform, it should be treated as informational or preparatory only.",
  },
  {
    title: "5. Account Registration and Link Security",
    content: "You must provide accurate information when creating an account. The workspace owner is the individual or organization that purchases a workspace, or an authorized administrator designated by that organization. If an employee purchases a workspace on behalf of an organization and later leaves, ownership and administrative control over the workspace data remains with the organization — not the individual. Kontra may transfer administrative access upon request from the organization, subject to identity verification. You are responsible for maintaining the security of your account credentials and any access links (owner links and participant invite links) associated with your workspace. Do not share sensitive access links with unauthorized parties. Notify us immediately at security@kontraplatform.com if you suspect unauthorized access to your account or workspace links. We may suspend accounts that violate these terms or that we reasonably believe are being used fraudulently.",
  },
  {
    title: "6. Electronic Communications",
    content: "By using Kontra, you consent to receive electronic communications from us, including transactional emails (workspace activation, document upload notifications, task updates, and participant invitations) and, where you have opted in, product updates. You agree that electronic notices satisfy any legal requirement that communications be in writing. You may opt out of non-transactional emails at any time. Transactional emails related to active workspace operations cannot be disabled while a workspace is active.",
  },
  {
    title: "7. Acceptable Use",
    content: "You agree not to: (a) upload documents you do not own or have authorization to process; (b) upload or process personal information of third parties without a lawful basis and all necessary rights, notices, and authorizations; (c) attempt to reverse-engineer, scrape, or extract data from the platform in bulk; (d) use the AI tools to generate fraudulent documents or misrepresent asset conditions; (e) use the Fundraising workflow to publicly advertise securities offerings, match issuers with investors you did not already know, or conduct any unregistered securities offering; (f) share workspace access links with unauthorized parties; (g) interfere with the operation of the platform or other users' access; (h) use the platform for any illegal purpose. Violation of these terms may result in immediate account termination.",
  },
  {
    title: "8. Your Content",
    content: "You retain ownership of all documents and data you upload to Kontra. By uploading content, you grant Kontra a limited, non-exclusive license to process that content solely to provide the services (document analysis, storage, display within your workspace, AI processing). We do not claim ownership of your transaction data, documents, or analysis results. You are responsible for ensuring you have the rights to upload the content you provide and that you have a lawful basis for any personal information contained in uploaded documents.",
  },
  {
    title: "9. AI Analysis Disclaimer",
    content: "Kontra's AI tools — including document analysis, the Operations Manager, Morning Briefing, Daily Standup, deal health scoring, and task automation — are powered by large language models and are designed to assist, not replace, professional judgment. AI outputs: (a) may contain errors or omissions; (b) should not be relied upon as the sole basis for financial, legal, investment, or operational decisions; (c) do not constitute a professional inspection, appraisal, legal opinion, insurance assessment, or investment recommendation; (d) do not represent the views of a licensed attorney, financial adviser, engineer, or any other regulated professional. Material AI-generated recommendations and automated actions are recorded in an application audit log. Always verify AI-generated findings with qualified professionals before acting on them. Kontra disclaims liability for decisions made based solely on AI output.",
  },
  {
    title: "10. Service Availability",
    content: "The platform is provided on an 'as is' and 'as available' basis without warranties of any kind, express or implied, including warranties of merchantability, fitness for a particular purpose, or non-infringement. Kontra does not warrant that the platform will be error-free, uninterrupted, or free from third-party service outages. We may modify, suspend, or discontinue features at any time with reasonable notice where practicable.",
  },
  {
    title: "11. Workspace Purchases and Billing",
    content: "Paid workspaces are purchased as one-time transactions through Stripe Checkout unless the checkout page expressly identifies a recurring plan. The charge amount, included features, and workspace scope are displayed before purchase. Kontra does not store card numbers — payment is processed directly by Stripe. Refunds may be requested within 7 days of purchase provided the workspace has not processed documents, sent participant invitations, or used AI analysis. To request a refund, email support@kontraplatform.com. Kontra may change pricing for future workspace purchases at any time. A price change will not alter the price of a workspace already purchased.",
  },
  {
    title: "12. Workspace Duration and Retention",
    content: "A paid workspace remains active until it is closed by the owner, terminated under these Terms, or discontinued following notice under the applicable purchase terms. Workspace data is retained for the duration of the active workspace. Following workspace closure or account termination, data is retained for up to 30 days to allow export requests, after which it is deleted. Deleted data may remain in encrypted backups for a limited period until those backups are overwritten in the ordinary course and will not be restored except for disaster recovery or legal obligations. Customers requiring longer retention for legal, contractual, or compliance reasons may contact support@kontraplatform.com — subject to a written agreement.",
  },
  {
    title: "13. Your Responsibility to Export Records",
    content: "Kontra is a transaction workspace tool, not an official books-and-records repository. Before closing or terminating a workspace, you are responsible for exporting any records you need for your own compliance, tax, legal, or business purposes. Kontra is not liable for any records you fail to export before the end of the 30-day post-termination retention window.",
  },
  {
    title: "14. Intellectual Property",
    content: "The Kontra platform, brand, design, software, proprietary prompts, workflow logic, configurations, interfaces, and analysis methods are owned by the operator of kontraplatform.com and protected by applicable intellectual property laws. You may not copy, modify, or distribute any part of the platform without written consent. These terms do not grant you any rights to our trademarks or trade names.",
  },
  {
    title: "15. Limitation of Liability",
    content: "To the maximum extent permitted by law, Kontra's total liability to you for any claims arising from these terms or your use of the platform shall not exceed the greater of: (a) $100 USD, or (b) the amounts you paid to Kontra in the 12 months preceding the claim. Kontra is not liable for indirect, incidental, consequential, or punitive damages, including lost profits or data loss, even if advised of the possibility of such damages.",
  },
  {
    title: "16. Indemnification",
    content: "You agree to defend and indemnify Kontra and its operator, personnel, and agents from and against any claims, damages, or expenses (including legal fees) arising from: (a) your use of the platform; (b) your violation of these terms; (c) your violation of any third party's rights; (d) any content you upload that infringes third-party rights; or (e) any securities or regulatory violation arising from your use of the Fundraising or tokenization features.",
  },
  {
    title: "17. Termination",
    content: "You may terminate your account at any time by contacting support@kontraplatform.com. We may suspend or terminate your account for material breach of these terms, with or without notice depending on severity. Upon termination, your access to the workspace ceases immediately. We will retain your data for up to 30 days following termination, during which you may request an export.",
  },
  {
    title: "18. Governing Law and Disputes",
    content: "These terms are governed by the laws of the State of New York, without regard to conflict of law principles. Any dispute arising from these terms or your use of Kontra shall be resolved by binding arbitration administered by JAMS under its Commercial Arbitration Rules. Class action waiver: you agree to resolve disputes individually, not as part of a class action.",
  },
  {
    title: "19. Changes to Terms",
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
          <p className="text-sm text-gray-500">Effective date: June 9, 2026 · Last updated: July 11, 2026</p>
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
        </div>
      </div>
    </PublicLayout>
  );
}
