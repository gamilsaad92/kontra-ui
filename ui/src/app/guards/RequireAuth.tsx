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
 return <div className="p-6 text-sm text-slate-600">Checking session...</div>;
  }

  if (!session?.access_token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

 return <>{children}</>;
}
