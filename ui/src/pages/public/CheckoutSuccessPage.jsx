import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicLayout from "./PublicLayout";

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const property = searchParams.get("property") || "";
  const plan = searchParams.get("plan") || "deal";
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const t = setInterval(() => setDots((d) => d.length >= 3 ? "." : d + "."), 500);
    return () => clearInterval(t);
  }, []);

  const planLabel = plan === "pro_annual" ? "Pro Annual" : plan === "pro_monthly" ? "Pro Monthly" : "Deal Room";

  return (
    <PublicLayout hideFooter>
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: "#f0fdf4" }}>
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Deal Room Activated!</h1>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Your <strong>{planLabel}</strong> is now live.
            {property && <> Deal room for <strong>{property.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</strong> is ready.</>}
            {" "}A confirmation has been sent to your email.
          </p>

          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 mb-8 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">What happens next</p>
            {[
              { icon: "🔗", title: "Share deal room links", desc: "Send role-scoped invite links to your lender, inspector, insurer, and other parties." },
              { icon: "📄", title: "Upload documents", desc: "Add your financial package, inspection report, and insurance certificate — AI will structure them automatically." },
              { icon: "✅", title: "Track compliance", desc: "All parties can see the compliance checklist and deal status in real time." },
            ].map((step) => (
              <div key={step.title} className="flex gap-3 py-3 border-t border-gray-100 first:border-t-0">
                <span className="text-xl shrink-0">{step.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{step.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {property && (
              <Link to={`/deal-room/${property}?role=lender`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "#800020" }}>
                Open Deal Room →
              </Link>
            )}
            <Link to="/properties"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition">
              Browse Properties
            </Link>
          </div>

          <p className="text-xs text-gray-400 mt-6">
            Questions? Email <a href="mailto:hello@kontraplatform.com" className="underline">hello@kontraplatform.com</a>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
