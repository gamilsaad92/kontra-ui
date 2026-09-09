import React from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const PILLARS = [
  {
    icon: "🔐",
    title: "Encryption",
    items: [
      "Kontra's public web and API connections use modern TLS encryption. Infrastructure-level connections may use TLS 1.2 or higher depending on provider configuration.",
      "Kontra's infrastructure providers encrypt stored data at rest using industry-standard encryption, including AES-256 where supported and configured.",
      "Document download links are signed and expire after 1 hour. Sharing a link does not grant permanent access.",
    ],
  },
  {
    icon: "🏗️",
    title: "Infrastructure",
    items: [
      "API server hosted on Render. Refer to Render's current security documentation for provider-level controls.",
      "Database and file storage on Supabase, running on AWS. Refer to Supabase's current security documentation for provider-level controls.",
      "Provider security and compliance statements apply to each provider's own infrastructure and do not mean that Kontra itself holds a certification. Kontra is not currently SOC 2 certified (see Compliance Roadmap).",
      "Document files stored in AWS S3-compatible storage.",
    ],
  },
  {
    icon: "🔒",
    title: "Access Controls",
    items: [
      "Row-level security and application-level authorization controls are designed to prevent unauthorized cross-deal-room data access.",
      "Third-party participants who upload via invite link cannot access other participants' uploads or the deal room owner's view.",
      "Application controls are designed to limit production document access to authorized personnel with a legitimate operational need; access requires authentication and is logged where supported.",
      "Document download links are signed and expire after 1 hour.",
    ],
  },
  {
    icon: "🤖",
    title: "AI Processing",
    items: [
      "Document text may be sent to a configured third-party AI provider for analysis at upload time.",
      "Provider retention and processing terms depend on the configured endpoint and current provider agreement; see the Privacy Policy for the current disclosure.",
      "Kontra will update this disclosure when the configured provider or processing arrangement changes.",
      "AI-generated recommendations, task assignments, and deal health assessments are recorded in a deal room audit log.",
    ],
  },
  {
    icon: "📋",
    title: "Audit Logging",
    items: [
      "Material deal room actions — AI-generated recommendations, task creation, task status changes, document uploads, AI analysis results, and approvals — are recorded in an application audit log with timestamps and attributed parties.",
      "Audit logs are designed to be append-only through the application layer. Administrative or infrastructure-level access is separate and restricted.",
      "Deal room owners can request an audit log export by emailing gamilsaad@kontraplatform.com.",
    ],
  },
  {
    icon: "🛡️",
    title: "Data Isolation",
    items: [
      "Each deal room is isolated — row-level security and application-level controls are designed to prevent one deal room from reading data belonging to another.",
      "Deal room participants only see documents and tasks scoped to their role and upload session.",
      "Deal room owners retain full visibility and control over all participants' uploads.",
      "Development and production environments are separated.",
    ],
  },
  {
    icon: "📣",
    title: "Incident Response",
    items: [
      "In the event of a confirmed data breach affecting personal information, Kontra will provide legally required notices without unreasonable delay and within any time period required by applicable law.",
      "To report a security concern, email support@kontraplatform.com — we aim to acknowledge reports within one business day.",
    ],
  },
  {
    icon: "📆",
    title: "Compliance Roadmap",
    items: [
      "Kontra is not currently SOC 2 certified. Any future audit or certification work remains subject to scope, timing, and completion.",
      "Data Processing Agreement requests may be discussed by contacting gamilsaad@kontraplatform.com; availability depends on the applicable service arrangement.",
      "For vendor security questionnaires, email gamilsaad@kontraplatform.com.",
    ],
  },
];

export default function SecurityPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Security</h1>
          <p className="text-sm text-gray-500 mb-4">Last updated: July 2026</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            Kontra is built for commercial transactions — deals where sensitive financial documents, legal
            agreements, and multi-party communications are at stake. This page describes the controls currently
             used to protect your data. These controls are designed to reduce risk;
             they are not a guarantee that a service will be uninterrupted or immune from every threat.
          </p>
        </div>

        <div className="mb-10 p-5 rounded-xl border border-gray-200 bg-gray-50">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">At a glance</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {[
              ["Encryption in transit", "Modern TLS (1.2+)"],
              ["Encryption at rest", "AES-256 (provider-level)"],
              ["Infrastructure providers", "AWS · Render · Supabase"],
              ["Document link expiry", "1 hour (signed URLs)"],
              ["AI model training", "Kontra does not train on your deal data"],
            ["Data sold for advertising", "No"],
              ["Audit logging", "Material actions logged"],
              ["Kontra SOC 2 certified", "Not currently"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm py-1 border-b border-gray-100">
                <span className="text-gray-600">{label}</span>
                <span className="font-medium text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-10">
          {PILLARS.map((pillar) => (
            <div key={pillar.title}>
              <div className="flex items-center gap-2.5 mb-4">
                <span className="text-xl">{pillar.icon}</span>
                <h2 className="text-base font-bold text-gray-900">{pillar.title}</h2>
              </div>
              <ul className="space-y-2.5">
                {pillar.items.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-gray-600 leading-relaxed">
                    <span className="text-gray-300 mt-0.5 shrink-0">→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 p-5 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Report a security issue</p>
            <p className="text-sm text-gray-600">
              Email{" "}
              <a href="mailto:support@kontraplatform.com" className="underline hover:text-gray-900">
                support@kontraplatform.com
              </a>
              {" "}— we aim to acknowledge reports within one business day.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Enterprise and DPA requests</p>
            <p className="text-sm text-gray-600">
              For vendor security questionnaires or Data Processing Agreement requests, email{" "}
              <a href="mailto:gamilsaad@kontraplatform.com" className="underline hover:text-gray-900">
                gamilsaad@kontraplatform.com
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
