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
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#f7f8fb" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
          <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "#888" }}>
            Loading
          </span>
        </div>
      </div>
    );
  }

  if (!session?.access_token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

 return <>{children}</>;
}
