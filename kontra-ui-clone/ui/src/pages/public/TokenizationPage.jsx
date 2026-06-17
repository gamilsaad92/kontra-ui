import React from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

export default function TokenizationPage() {
  return (
    <PublicLayout>
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md mx-auto px-6 text-center">
          <div className="text-4xl mb-4">🏗️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Looking for something?</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            This page has moved. Kontra is CRE deal room infrastructure — helping lenders, borrowers, and service providers close deals faster with structured, verified data.
          </p>
          <div className="flex flex-col gap-2">
            <Link to="/how-it-works"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              See how deal rooms work →
            </Link>
            <Link to="/create-deal-room"
              className="px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition">
              Create a deal room — $499
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
