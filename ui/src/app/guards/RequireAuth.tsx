import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

type RequireAuthProps = {
  loading: boolean;
  session: { access_token?: string | null } | null;
  children: ReactNode;
};

export default function RequireAuth({ loading, session, children }: RequireAuthProps) {
  const location = useLocation();
    
  if (loading) {
    return <div style={{ padding: 24 }}>Checking session...</div>;
  }

  if (!session?.access_token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

 return <>{children}</>;
}
