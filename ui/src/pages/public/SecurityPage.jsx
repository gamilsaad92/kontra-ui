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
      "API server hosted on Render (SOC 2 Type II certified infrastructure).",
      "Database and file storage on Supabase, running on AWS (SOC 2 Type II, ISO 27001).",
      "Document files stored in AWS S3-compatible storage — never on local or shared disk.",
      "Automated daily database backups with point-in-time recovery.",
    ],
  },
  {
    icon: "🔒",
    title: "Access Controls",
    items: [
      "Deal room data is isolated by property ID using row-level security — no cross-tenant data access is possible at the database layer.",
      "Third-party parties (lenders, inspectors, attorneys) who upload via invite link cannot access other participants' uploads or the deal room owner's view.",
      "Internal Kontra staff access to production data requires multi-factor authentication and is logged.",
      "No Kontra employee can access your uploaded documents without a signed URL generated on demand.",
    ],
  },
  {
    icon: "🤖",
    title: "AI Processing",
    items: [
      "Document text is sent to OpenAI's API (GPT-4o / GPT-4o-mini) for analysis at upload time only.",
      "OpenAI's API terms prohibit training models on API inputs — your document content is not used to train any AI model.",
      "OpenAI does not retain document content after the API call completes.",
      "AI-generated recommendations, task assignments, and deal health assessments are logged and attributable.",
    ],
  },
  {
    icon: "📋",
    title: "Audit Logging",
    items: [
      "Every AI-generated recommendation is logged with a timestamp and the model that produced it.",
      "Every task creation, assignment, status change, and resolution is recorded in an immutable audit trail.",
      "Every document upload, AI analysis, and approval action is attributed to the initiating party.",
      "Audit logs are available to workspace owners and are retained for the life of the deal room plus seven years.",
    ],
  },
  {
    icon: "🛡️",
    title: "Data Isolation",
    items: [
      "Each deal room is isolated — no workspace can read data from another workspace.",
      "Deal room participants only see documents and tasks scoped to their role and upload session.",
      "Workspace owners retain full visibility and control over all parties' uploads.",
      "Development and production environments are fully separated — no production data is used in testing.",
    ],
  },
  {
    icon: "📣",
    title: "Incident Response",
    items: [
      "In the event of a confirmed data breach affecting personal information, affected workspace owners will be notified within 72 hours.",
      "Security incidents are logged and reviewed by the Kontra team.",
      "To report a security concern, email security@kontraplatform.com — we respond within 24 hours on business days.",
    ],
  },
  {
    icon: "📆",
    title: "Compliance Roadmap",
    items: [
      "SOC 2 Type II audit is on the roadmap for enterprise readiness.",
      "Data Processing Agreement (DPA) templates are available upon request for enterprise customers.",
      "Document retention policy is designed to meet IRS § 6501 and SEC Rule 17a-4 requirements.",
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
              ["Infrastructure", "AWS / Render / Supabase"],
              ["Document link expiry", "1 hour (signed URLs)"],
              ["AI training on your data", "Never"],
              ["Data sold to third parties", "Never"],
              ["Audit logging", "Every action, immutable"],
              ["Data retention", "Deal life + 7 years"],
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
              {" "}— we respond within 24 hours on business days. Please include as much detail as possible.
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
          <p className="text-sm text-gray-500">
            Kontra Platform, Inc. · 1 World Trade Center · New York, NY 10007
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
