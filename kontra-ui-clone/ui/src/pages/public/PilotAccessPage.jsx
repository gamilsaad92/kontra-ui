import { useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

// PilotAccessPage — token-storing handoff page for pilot users.
// The admin pastes a link like:
//   /pilot/access?property={pid}&owner_token={token}&name={name}
// into an email/DM. When the pilot user clicks it, this page:
//   1. Stores the owner_token in localStorage (same mechanic as CheckoutSuccessPage)
//   2. Redirects to the live workspace as coordinator
// No payment, no setup, no confusion.
export default function PilotAccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const stored = useRef(false);

  const property   = searchParams.get("property") || "";
  const ownerToken = searchParams.get("owner_token") || "";
  const name       = searchParams.get("name") || "your deal room";

  useEffect(() => {
    if (stored.current) return;
    stored.current = true;

    // Store the owner token exactly as CheckoutSuccessPage does
    if (property && ownerToken) {
      try {
        localStorage.setItem(`kontra_owner_token_${property}`, ownerToken);
      } catch { /* storage unavailable */ }
    }

    // Short delay so the user sees the loading state before redirect
    const t = setTimeout(() => {
      if (property) {
        navigate(`/deal-room/${property}?role=owner`, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }, 1200);

    return () => clearTimeout(t);
  }, [property, ownerToken, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center mx-auto mb-5 text-2xl">
          🚀
        </div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">Setting up your deal room…</h1>
        <p className="text-sm text-gray-500 leading-relaxed">
          Preparing <strong>{name}</strong> — you'll be redirected automatically.
        </p>
        <div className="mt-6 flex justify-center">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
