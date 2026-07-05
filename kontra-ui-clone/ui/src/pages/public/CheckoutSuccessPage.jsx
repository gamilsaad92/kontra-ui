import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicLayout from "./PublicLayout";
import { getWorkflowPack } from "../../lib/workflowPacks";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

// Fallback for CRE Acquisition rooms while workflow_pack_id is loading.
const FALLBACK_ROLES = [
  { id: "lender",    icon: "🏦", label: "Lender / Underwriter" },
  { id: "inspector", icon: "🔍", label: "Inspector / Engineer" },
  { id: "insurer",   icon: "🛡️", label: "Insurance Broker" },
  { id: "attorney",  icon: "📜", label: "Attorney / Title" },
  { id: "investor",  icon: "📊", label: "Investor" },
  { id: "servicer",  icon: "⚙️", label: "Servicer" },
];

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const property = searchParams.get("property") || "";
  const plan = searchParams.get("plan") || "deal";
  const [copied, setCopied] = useState("");
  // Which invite links to show is pack-driven — each pack's `roles` list
  // marks invitable roles (Business Acquisition invites buyer/cpa/counsel
  // rather than CRE's lender/inspector/insurer). Fetch the room's pack once.
  const [roles, setRoles] = useState(FALLBACK_ROLES);
  // The creator's own role isn't always "owner" — Business Acquisition's
  // creator role is "buyer" (no "owner" role exists in that pack), so this
  // must come from the room record rather than being hardcoded.
  const [ownRole, setOwnRole] = useState("owner");

  useEffect(() => {
    if (!property) return;
    fetch(`${API_BASE}/api/public/deal-room/${property}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((room) => {
        if (!room || room.error) return;
        const pack = getWorkflowPack(room.workflow_pack_id);
        const invitable = (pack.roles || [])
          .filter((r) => r.invitable)
          .map((r) => ({ id: r.key, icon: r.icon, label: r.label }));
        if (invitable.length > 0) setRoles(invitable);
        if (room.role) setOwnRole(room.role);
      })
      .catch(() => {});
  }, [property]);

  const planLabel = plan === "pro_annual" ? "Pro Annual" : plan === "pro_monthly" ? "Pro Monthly" : "Deal Room";
  const propertyLabel = property
    ? property.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : "";
  const BASE = "https://kontraplatform.com";

  function copyLink(role) {
    const url = `${BASE}/deal-room/${property}?role=${role}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(role);
      setTimeout(() => setCopied(""), 2000);
    });
  }

  return (
    <PublicLayout hideFooter>
      <div className="min-h-[80vh] px-6 py-12">
        <div className="max-w-2xl mx-auto">

          {/* Success header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "#f0fdf4" }}>
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Deal Room Activated!</h1>
            <p className="text-gray-500 text-sm">
              {propertyLabel && <><strong>{propertyLabel}</strong> · </>}
              {planLabel} · A receipt has been sent to your email
            </p>
          </div>

          {/* Invite links — the most important thing */}
          {property && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-5">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-900">Step 1 — Send invite links to each party</p>
                <p className="text-xs text-gray-500 mt-0.5">Each link shows only what's relevant to that role. Click to copy.</p>
              </div>
              <div className="divide-y divide-gray-100">
                {roles.map((r) => {
                  const url = `${BASE}/deal-room/${property}?role=${r.id}`;
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-lg shrink-0">{r.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700">{r.label}</p>
                        <p className="text-[10px] text-gray-400 truncate">{url}</p>
                      </div>
                      <button onClick={() => copyLink(r.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          copied === r.id
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}>
                        {copied === r.id ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Next steps */}
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Step 2 — Populate your deal room</p>
            {[
              { icon: "📄", title: "Upload financial statements", desc: "Operating statement, rent roll, T12 — AI structures them automatically" },
              { icon: "🔍", title: "Request an inspection report", desc: "Send the inspector link above; their report goes directly into the room" },
              { icon: "🛡️", title: "Add insurance certificate", desc: "AI reviews coverage gaps and tracks expiration dates for your lender" },
            ].map((step) => (
              <div key={step.title} className="flex gap-3 py-2.5 border-t border-gray-100 first:border-t-0">
                <span className="text-lg shrink-0">{step.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-800">{step.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {property && (
              <Link to={`/deal-room/${property}?role=${ownRole}`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "#800020" }}>
                Open My Deal Room →
              </Link>
            )}
            <a href="mailto:hello@kontraplatform.com"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition">
              Contact Support
            </a>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
}
