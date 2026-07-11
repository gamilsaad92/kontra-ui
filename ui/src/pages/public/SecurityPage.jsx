import React from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const PILLARS = [
  {
    icon: "🔐",
    title: "Encryption",
    items: [
      "All data in transit is encrypted with TLS 1.3.",
      "All data at rest is encrypted with AES-256 — documents, database records, and AI analysis outputs.",
      "Document download links are signed and expire after 1 hour. Sharing a link does not grant permanent access.",
    ],
  },
  {
    icon: "🏗️",
    title: "Infrastructure",
    items: [
      "API server hosted on Render. Render maintains SOC 2 Type 2 and related compliance controls covering its infrastructure.",
      "Database and file storage on Supabase, running on AWS. Supabase maintains SOC 2 and ISO 27001 certifications covering its infrastructure.",
      "These provider certifications apply to each provider's own infrastructure and do not mean that Kontra itself holds those certifications.",
      "Document files stored in AWS S3-compatible storage.",
    ],
  },
  {
    icon: "🔒",
    title: "Access Controls",
    items: [
      "Row-level security and application-level authorization controls are designed to prevent unauthorized cross-workspace data access.",
      "Third-party participants who upload via invite link cannot access other participants' uploads or the workspace owner's view.",
      "Production document access is restricted to authorized personnel with a legitimate operational need, requires authenticated access, and is logged.",
      "Document download links are signed and expire after 1 hour.",
    ],
  },
  {
    icon: "🤖",
    title: "AI Processing",
    items: [
      "Document text is sent to OpenAI's API (GPT-4o / GPT-4o-mini) for analysis at upload time.",
      "By default, OpenAI does not use API inputs or outputs to train its models. Depending on the API configuration and endpoint used, OpenAI may retain certain inputs and outputs for up to 30 days for abuse monitoring.",
      "Kontra will update this disclosure if it obtains approved Zero Data Retention status with OpenAI.",
      "AI-generated recommendations, task assignments, and deal health assessments are recorded in a workspace audit log.",
    ],
  },
  {
    icon: "📋",
    title: "Audit Logging",
    items: [
      "Material workspace actions — AI-generated recommendations, task creation, task status changes, document uploads, AI analysis results, and approvals — are recorded in an application audit log with timestamps and attributed parties.",
      "Audit logs are designed to be append-only through the application layer. Administrative or infrastructure-level access is separate and restricted.",
      "Workspace owners can request an audit log export by emailing privacy@kontraplatform.com.",
    ],
  },
  {
    icon: "🛡️",
    title: "Data Isolation",
    items: [
      "Each workspace is isolated — row-level security and application-level controls are designed to prevent one workspace from reading data belonging to another.",
      "Workspace participants only see documents and tasks scoped to their role and upload session.",
      "Workspace owners retain full visibility and control over all participants' uploads.",
      "Development and production environments are separated.",
    ],
  },
  {
    icon: "📣",
    title: "Incident Response",
    items: [
      "In the event of a confirmed data breach affecting personal information, Kontra will provide legally required notices without unreasonable delay and within any time period required by applicable law.",
      "To report a security concern, email security@kontraplatform.com — we respond within 24 hours on business days.",
    ],
  },
  {
    icon: "📆",
    title: "Compliance Roadmap",
    items: [
      "SOC 2 Type II audit is on the roadmap for enterprise readiness. Kontra is not currently SOC 2 certified.",
      "Data Processing Agreement (DPA) templates are available upon request for enterprise customers.",
      "For vendor security questionnaires, email legal@kontraplatform.com.",
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
            agreements, and multi-party communications are at stake. This page describes how we protect
            your data at every layer of the platform.
          </p>
        </div>

        <div className="mb-10 p-5 rounded-xl border border-gray-200 bg-gray-50">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">At a glance</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {[
              ["Encryption in transit", "TLS 1.3"],
              ["Encryption at rest", "AES-256"],
              ["Infrastructure providers", "AWS · Render · Supabase"],
              ["Document link expiry", "1 hour (signed URLs)"],
              ["AI training on your data", "Not by default"],
              ["Data sold to third parties", "Never"],
              ["Audit logging", "Material actions logged"],
              ["Kontra SOC 2 certified", "Not yet (roadmap)"],
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
              <a href="mailto:security@kontraplatform.com" className="underline hover:text-gray-900">
                security@kontraplatform.com
              </a>
              {" "}— we respond within 24 hours on business days.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-1">Enterprise and DPA requests</p>
            <p className="text-sm text-gray-600">
              For vendor security questionnaires or Data Processing Agreement requests, email{" "}
              <a href="mailto:legal@kontraplatform.com" className="underline hover:text-gray-900">
                legal@kontraplatform.com
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
