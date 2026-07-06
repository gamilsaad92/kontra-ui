import { ReactNode, useContext } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthContext } from "../../lib/authContext";

type RequireAuthProps = {
  children: ReactNode;
};

export default function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation();
    const { loading, session } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#0a0a0f" }}>
        <div className="flex flex-col items-center gap-4">
          <div
            style={{
              width: 44, height: 44, background: "#800020",
              borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 32px rgba(128,0,32,0.5)",
            }}
          >
            <span style={{ color: "#fff", fontSize: 20, fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1 }}>K</span>
          </div>
          <div style={{ width: 160, height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden", position: "relative" }}>
            <div
              style={{
                position: "absolute", top: 0, height: "100%", width: "60%",
                background: "linear-gradient(90deg,transparent,#800020,transparent)",
                borderRadius: 99,
                animation: "kontra-scan 1.35s ease-in-out infinite",
              }}
            />
          </div>
          <span style={{ color: "#444", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase" }}>
            Kontra
          </span>
          <style>{`@keyframes kontra-scan{0%{left:-60%}100%{left:100%}}`}</style>
        </div>
      </div>
    );
  }

  // Allow demo mode to bypass auth — demo flag set by login page shortcuts
  const isDemoMode = (() => { try { return localStorage.getItem("kontra_demo_mode") === "true"; } catch { return false; } })();

  if (!session?.access_token && !isDemoMode) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
