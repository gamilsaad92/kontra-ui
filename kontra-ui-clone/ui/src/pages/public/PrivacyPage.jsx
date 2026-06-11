import React from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const SECTIONS = [
  {
    title: "Information We Collect",
    content: [
      "**Account information**: When you create a Kontra account, we collect your email address and, optionally, your name and company.",
      "**Property data**: Information you enter about properties you manage — addresses, unit counts, occupancy, financial data, and documents you upload for AI analysis.",
      "**Usage data**: Pages visited, features used, and actions taken within the platform, collected to improve the product.",
      "**Device and technical data**: IP address, browser type, operating system, and access times — collected automatically when you use the platform.",
      "**Uploaded documents**: Inspection reports, insurance policies, financial statements, and other documents you upload for AI analysis. These are processed and not retained beyond the session unless you save them to your workspace.",
    ],
  },
  {
    title: "How We Use Your Information",
    content: [
      "**Provide the service**: Power your property workspace, run AI document analysis, and maintain your property records.",
      "**Improve the product**: Understand how features are used to prioritize improvements. We never use your specific property data to train AI models.",
      "**Communicate with you**: Send transactional emails (account creation, compliance alerts, password reset) and, with your consent, product updates.",
      "**Security and fraud prevention**: Detect and prevent unauthorized access, abuse, and fraud.",
      "**Legal compliance**: Comply with applicable laws and respond to lawful requests from authorities.",
    ],
  },
  {
    title: "Data Storage and Security",
    content: [
      "Property data and user accounts are stored in Supabase, which runs on AWS infrastructure with SOC 2 Type II certification.",
      "Documents uploaded for AI analysis are processed in-memory and are not persisted to long-term storage unless explicitly saved by the user.",
      "All data is encrypted in transit (TLS 1.3) and at rest (AES-256).",
      "We implement row-level security ensuring each user can only access their own data.",
      "We do not sell your data to third parties. Ever.",
    ],
  },
  {
    title: "Third-Party Services",
    content: [
      "**OpenAI**: Document text is sent to OpenAI's API for analysis. OpenAI's API terms prohibit them from training models on API inputs. See openai.com/policies.",
      "**Supabase**: Database and authentication provider. See supabase.com/privacy.",
      "**Vercel**: Frontend hosting. See vercel.com/legal/privacy-policy.",
      "**Stripe**: Payment processing for paid subscriptions. We do not store payment card information. See stripe.com/privacy.",
      "We do not use advertising networks, data brokers, or behavioral tracking pixels.",
    ],
  },
  {
    title: "Your Rights",
    content: [
      "**Access**: Request a copy of all data we hold about you.",
      "**Correction**: Update or correct inaccurate data at any time through your account settings.",
      "**Deletion**: Delete your account and all associated data. Property records, documents, and AI analysis history are permanently deleted within 30 days.",
      "**Portability**: Export your property data in a standard format (JSON or CSV) at any time.",
      "**Opt-out**: Unsubscribe from marketing emails at any time. Transactional emails (security, compliance) cannot be opted out of while your account is active.",
      "To exercise any of these rights, email us at privacy@kontraplatform.com.",
    ],
  },
  {
    title: "Cookies",
    content: [
      "We use essential cookies only: authentication session tokens and security cookies required for the platform to function.",
      "We do not use advertising cookies, tracking pixels, or third-party analytics cookies.",
      "You can disable cookies in your browser, but this will prevent you from logging in.",
    ],
  },
  {
    title: "Changes to This Policy",
    content: [
      "We will notify users by email and in-app banner at least 14 days before material changes to this policy take effect.",
      "Continued use of Kontra after the effective date constitutes acceptance of the updated policy.",
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
          <p className="text-sm text-gray-500">Effective date: June 9, 2026 · Last updated: June 9, 2026</p>
          <p className="text-sm text-gray-600 mt-4 leading-relaxed">
            Kontra Platform, Inc. ("Kontra", "we", "us") operates kontraplatform.com and the Kontra CRE workspace. 
            This policy explains what data we collect, how we use it, and your rights as a user.
          </p>
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
            Questions about this policy or your data: <a href="mailto:privacy@kontraplatform.com" className="underline hover:text-gray-900">privacy@kontraplatform.com</a>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Kontra Platform, Inc. · 1 World Trade Center · New York, NY 10007
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
