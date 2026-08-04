import React, { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicLayout from "./PublicLayout";

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const property   = searchParams.get("property") || "";
  const plan       = searchParams.get("plan") || "deal";
  const ownerToken = searchParams.get("owner_token") || "";
  // `name` carries the clean workspace name the user entered; fall back to
  // transforming the slug only when the param is absent (e.g. old links).
  const nameParam  = searchParams.get("name") || "";

  // Persist the owner write token in localStorage so the workspace's checklist
  // panel can send it when authorising server-side mutations.  This is the only
  // channel through which the token is delivered — it is never exposed in any
  // public GET response.
  useEffect(() => {
    if (property && ownerToken) {
      try {
        localStorage.setItem(`kontra_owner_token_${property}`, ownerToken);
      } catch { /* storage unavailable */ }
    }
  }, [property, ownerToken]);

  const planLabel     = plan === "pro_annual" ? "Pro Annual" : plan === "pro_monthly" ? "Pro Monthly" : "Workspace";
  const propertyLabel = nameParam
    ? nameParam
    : property
      ? property.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
      : "";

  return (
    <PublicLayout hideFooter>
      <div className="min-h-[80vh] px-6 py-12">
        <div className="max-w-xl mx-auto">

          {/* Success header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "#f0fdf4" }}>
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Workspace Activated!</h1>
            <p className="text-gray-500 text-sm">
              {propertyLabel && <><strong>{propertyLabel}</strong> · </>}
              {planLabel} · A receipt has been sent to your email
            </p>
          </div>

          {/* Next steps */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-5 divide-y divide-gray-100">

            <div className="flex gap-4 px-5 py-4">
              <div className="w-8 h-8 rounded-full bg-[#800020]/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-sm font-bold text-[#800020]">1</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Invite each party from inside your room</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                   Open your deal room and use the <strong>Invite</strong> panel to send each party
                  a secure, personalized link. Each person verifies their identity before they can
                  enter — no shared passwords or forwarded links.
                </p>
              </div>
            </div>

            <div className="flex gap-4 px-5 py-4">
              <div className="w-8 h-8 rounded-full bg-[#800020]/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-sm font-bold text-[#800020]">2</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Upload your documents</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                   Upload the documents configured for your deal room — financials, agreements,
                  due diligence materials, and more. AI analyzes each one automatically and
                  flags risks for every party.
                </p>
              </div>
            </div>

            <div className="flex gap-4 px-5 py-4">
              <div className="w-8 h-8 rounded-full bg-[#800020]/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-sm font-bold text-[#800020]">3</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Track progress to close</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  The deal health panel updates in real time as parties submit documents and
                  advance through due diligence, approval, and closing.
                </p>
              </div>
            </div>

          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {property && (
              <Link to={`/deal-room/${property}?role=owner`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "#800020" }}>
                Open My Workspace →
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
