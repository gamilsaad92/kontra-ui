import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../lib/authContext";

const USER_TYPES = [
  { id: "property_owner", label: "Property Owner", icon: "🏢", desc: "I own or manage CRE assets" },
  { id: "investor",       label: "Investor",        icon: "📈", desc: "I invest in CRE deals & portfolios" },
  { id: "vendor",         label: "Vendor / Service Provider", icon: "🔧", desc: "I offer CRE services" },
  { id: "consultant",     label: "Consultant",      icon: "💼", desc: "I advise on CRE transactions" },
  { id: "enterprise",     label: "Lender / Enterprise", icon: "🏦", desc: "Bank, fund, or institutional use" },
  { id: "other",          label: "Other",            icon: "✨", desc: "Something else entirely" },
];

const PRIMARY_GOALS = [
  { id: "analyze_property",   label: "Analyze a property",          icon: "🔍" },
  { id: "review_inspection",  label: "Review inspection photos",     icon: "📸" },
  { id: "upload_financials",  label: "Upload financials",            icon: "📊" },
  { id: "track_damage",       label: "Track a damage / claim issue", icon: "⚠️" },
  { id: "find_vendors",       label: "Find vendors",                 icon: "🔎" },
  { id: "list_services",      label: "List my services",             icon: "📋" },
  { id: "manage_portfolio",   label: "Manage a portfolio",           icon: "🗂️" },
];

export default function OnboardingPage() {
  const { session } = useContext(AuthContext);
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState(null);
  const [primaryGoal, setPrimaryGoal] = useState(null);

  const userId = session?.user?.id || "demo";

  function finish(goal) {
    const profile = { user_type: userType, primary_goal: goal, onboarding_completed: true };
    localStorage.setItem(`kontra_profile_${userId}`, JSON.stringify(profile));
    localStorage.setItem(`kontra_onboarding_${userId}`, "true");
    navigate("/workspace", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">K</div>
          <span className="text-white font-semibold text-lg tracking-tight">Kontra</span>
        </div>
        <div className="flex items-center gap-3 justify-center mt-4">
          {[1,2].map(n => (
            <div key={n} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${step >= n ? "bg-blue-600 border-blue-500 text-white" : "bg-gray-800 border-gray-600 text-gray-500"}`}>{n}</div>
              {n < 2 && <div className={`w-12 h-0.5 rounded ${step > n ? "bg-blue-500" : "bg-gray-700"}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="w-full max-w-2xl">
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold text-white text-center mb-2">What best describes you?</h1>
            <p className="text-gray-400 text-center mb-8 text-sm">We'll customize your workspace based on your role.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {USER_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setUserType(t.id); setStep(2); }}
                  className="flex items-start gap-4 p-4 rounded-xl border border-gray-700 hover:border-blue-500 hover:bg-gray-800/60 bg-gray-900 text-left transition-all group"
                >
                  <span className="text-2xl mt-0.5">{t.icon}</span>
                  <div>
                    <div className="text-white font-medium group-hover:text-blue-400 transition-colors">{t.label}</div>
                    <div className="text-gray-400 text-xs mt-0.5">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-300 text-sm mb-6 flex items-center gap-1 transition-colors">
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-white text-center mb-2">What do you want to do first?</h1>
            <p className="text-gray-400 text-center mb-8 text-sm">You can always change this later in your workspace.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PRIMARY_GOALS.map(g => (
                <button
                  key={g.id}
                  onClick={() => { setPrimaryGoal(g.id); finish(g.id); }}
                  className="flex items-center gap-4 p-4 rounded-xl border border-gray-700 hover:border-blue-500 hover:bg-gray-800/60 bg-gray-900 text-left transition-all group"
                >
                  <span className="text-xl">{g.icon}</span>
                  <span className="text-white font-medium group-hover:text-blue-400 transition-colors">{g.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => finish("explore")}
              className="w-full mt-4 py-3 text-gray-400 hover:text-gray-200 text-sm transition-colors"
            >
              Skip for now →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
