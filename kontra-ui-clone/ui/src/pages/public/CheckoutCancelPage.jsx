import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import PublicLayout from "./PublicLayout";

export default function CheckoutCancelPage() {
  const [searchParams] = useSearchParams();
  const property = searchParams.get("property") || "";
  const role = searchParams.get("role") || "lender";

  return (
    <PublicLayout hideFooter>
      <div className="min-h-[80vh] flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4">↩️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Payment cancelled</h1>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed">
            No charge was made. Your deal room is still waiting — come back whenever you're ready.
          </p>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-8 text-left">
            <p className="text-sm font-semibold text-amber-800 mb-1">Still interested?</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              The $499 deal room fee covers all parties — lenders, inspectors, insurers, attorneys — on one property. One payment, everyone in.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {property && (
              <Link to={`/deal-room/${property}?role=${role}`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: "#800020" }}>
                Back to Deal Room
              </Link>
            )}
            <Link to="/pricing"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition">
              View Pricing
            </Link>
          </div>

          <p className="text-xs text-gray-400 mt-6">
            Questions? <a href="mailto:hello@kontraplatform.com" className="underline">hello@kontraplatform.com</a>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
