import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "";

const LEGAL_DOC_TYPES = [
  "purchase_sale_agreement",
  "purchase-sale-agreement",
  "purchase agreement",
  "psa",
  "title_commitment",
  "title commitment",
  "title insurance",
  "operating_agreement",
  "operating agreement",
  "loan_agreement",
  "loan agreement",
  "promissory note",
  "letter_of_intent",
  "letter of intent",
  "loi",
  "closing_documents",
  "closing documents",
  "environmental_report",
  "environmental report",
  "phase i",
  "phase 1",
  "estoppel",
  "lease",
  "easement",
  "covenant",
  "deed",
  "warranty deed",
  "quitclaim",
];

const LEGAL_SECTION_LABELS = {
  purchase_sale_agreement: "Purchase & Sale Agreement",
  "purchase-sale-agreement": "Purchase & Sale Agreement",
  title_commitment: "Title Commitment",
  title: "Title / Title Commitment",
  operating_agreement: "Operating Agreement",
  loan_agreement: "Loan Agreement",
  letter_of_intent: "Letter of Intent",
  closing_documents: "Closing Documents",
  environmental_report: "Environmental Report",
  legal: "Legal / Title Review",
};

function isLegalDoc(sectionKey, filename) {
  const key = (sectionKey || "").toLowerCase();
  const name = (filename || "").toLowerCase();
  return LEGAL_DOC_TYPES.some((t) => key.includes(t) || name.includes(t));
}

function ReferralBadge({ label }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-100">
      {label}
    </span>
  );
}

function ProviderCard({ name, tagline, buttonLabel, href, featured, badge, disabled, disabledText, requestHref }) {
  return (
    <div
      className={`flex flex-col rounded-xl border p-4 transition ${
        disabled
          ? "bg-gray-50 border-gray-200 opacity-60"
          : featured
          ? "bg-white border-blue-200 shadow-sm hover:shadow-md"
          : "bg-white border-gray-200 hover:shadow-sm"
      }`}
      style={featured ? { borderLeftWidth: 3, borderLeftColor: "#3b82f6" } : {}}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-bold text-gray-900">{name}</span>
        {featured && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
            Featured
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 leading-relaxed mb-3 flex-1">
        {disabled ? disabledText : tagline}
      </p>
      {badge && !disabled && (
        <div className="mb-3">
          <ReferralBadge label={badge} />
        </div>
      )}
      {!disabled ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
          style={
            featured
              ? { background: "#3b82f6", color: "#fff" }
              : { background: "#f3f4f6", color: "#374151" }
          }
        >
          {buttonLabel}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-400">
            Coming Soon
          </span>
          {requestHref && (
            <a
              href={requestHref}
              className="text-[10px] text-center text-gray-400 hover:text-gray-600 underline underline-offset-2"
            >
              Request this provider
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function LegalDocRow({ label, uploaded, filename }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-sm">📄</span>
        <span className="text-sm text-gray-700">{label}</span>
        {filename && (
          <span className="text-xs text-gray-400 truncate max-w-[160px]">{filename}</span>
        )}
      </div>
      {uploaded ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Uploaded
        </span>
      ) : (
        <span className="text-[11px] font-medium text-gray-400">Pending</span>
      )}
    </div>
  );
}

export default function LegalReviewPanel({ propertyId, pack, isDemo }) {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId || isDemo) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/api/public/deal-room/${propertyId}/analyses`)
      .then((r) => (r.ok ? r.json() : { analyses: [] }))
      .catch(() => ({ analyses: [] }))
      .then((data) => {
        setAnalyses(data.analyses || []);
        setLoading(false);
      });
  }, [propertyId, isDemo]);

  const hasAttorneyRole = (pack?.roles || []).some(
    (r) =>
      (r.key || r.role || "").toLowerCase().includes("attorney") ||
      (r.label || "").toLowerCase().includes("attorney") ||
      (r.label || "").toLowerCase().includes("legal")
  );

  if (!hasAttorneyRole) return null;

  const uploadedLegalDocs = analyses.filter((a) =>
    isLegalDoc(a.section || a.document_type, a.filename)
  );

  const uploadedSectionKeys = new Set(uploadedLegalDocs.map((a) => a.section || a.document_type || ""));

  const allLegalSections = [
    { key: "legal", label: "Legal / Title Review" },
    { key: "purchase_sale_agreement", label: "Purchase & Sale Agreement" },
    { key: "title_commitment", label: "Title Commitment" },
    { key: "operating_agreement", label: "Operating Agreement" },
    { key: "loan_agreement", label: "Loan Agreement" },
    { key: "letter_of_intent", label: "Letter of Intent" },
    { key: "closing_documents", label: "Closing Documents" },
    { key: "environmental_report", label: "Environmental Report" },
  ];

  const packDocSections = (pack?.checklist || pack?.documents || []).filter((doc) =>
    isLegalDoc(doc.section || doc.key || doc.label || "", "")
  );

  const displaySections =
    packDocSections.length > 0
      ? packDocSections.map((d) => ({
          key: d.section || d.key,
          label: d.label || LEGAL_SECTION_LABELS[d.section || d.key] || d.section || d.key,
        }))
      : allLegalSections;

  return (
    <div id="legal-panel" className="bg-white rounded-2xl border border-gray-200 mb-6 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">⚖️</span>
          <h2 className="text-base font-bold text-gray-900">Legal Review</h2>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          Send your legal documents for AI-powered review by your preferred provider.
        </p>
        <div className="mt-3 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <svg className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-blue-700 leading-relaxed">
            Attorneys retain full control — Kontra routes documents to the provider of your choice.
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-6">
        {/* Legal Documents Found */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Legal Documents in This Deal Room
          </h3>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-9 bg-gray-50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : isDemo || uploadedLegalDocs.length > 0 ? (
            <div className="rounded-xl border border-gray-100 px-4 divide-y divide-gray-50">
              {isDemo ? (
                <>
                  <LegalDocRow label="Purchase & Sale Agreement" uploaded filename="PSA_draft_v3.pdf" />
                  <LegalDocRow label="Title Commitment" uploaded filename="Title_Commitment.pdf" />
                  <LegalDocRow label="Operating Agreement" uploaded={false} />
                  <LegalDocRow label="Loan Agreement" uploaded={false} />
                </>
              ) : (
                displaySections.map((s) => {
                  const match = uploadedLegalDocs.find(
                    (a) => (a.section || a.document_type || "") === s.key
                  );
                  return (
                    <LegalDocRow
                      key={s.key}
                      label={s.label}
                      uploaded={!!match}
                      filename={match?.filename}
                    />
                  );
                })
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center">
              <p className="text-sm text-gray-400">No legal documents uploaded yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Legal documents will appear here once parties upload them.
              </p>
            </div>
          )}
        </section>

        {/* Provider Cards */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Choose Your Legal AI Provider
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ProviderCard
              name="Harvey"
              featured
              tagline="Enterprise legal AI used by the world's top law firms."
              buttonLabel="Open in Harvey"
              href="https://www.harvey.ai"
              badge="Referral — use your own Harvey account"
            />
            <ProviderCard
              name="Spellbook"
              tagline="Contract review and drafting for transactional attorneys."
              buttonLabel="Open in Spellbook"
              href="https://www.spellbook.legal"
              badge="Referral — use your own Spellbook account"
            />
            <ProviderCard
              disabled
              name="More Providers"
              disabledText="Additional legal AI providers coming soon."
              requestHref="mailto:hello@kontra.ai?subject=Legal AI Provider Request"
            />
          </div>
        </section>

        {/* How it works */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
            How It Works
          </h3>
          <ol className="space-y-2.5">
            {[
              {
                icon: "📁",
                text: "Parties upload legal documents into the Kontra deal room through their role-specific link.",
              },
              {
                icon: "⚖️",
                text: "Your attorney opens their legal AI platform of choice using their own account.",
              },
              {
                icon: "🔒",
                text: "The attorney uploads and analyzes the documents — findings stay in their platform.",
              },
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-gray-600 leading-relaxed">{step.text}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Footer note */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-400 leading-relaxed">
          🔒 Kontra does not send documents to any third-party provider automatically. Your attorney initiates all legal AI sessions.
        </p>
      </div>
    </div>
  );
}
