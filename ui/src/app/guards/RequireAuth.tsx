import { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext } from "../../lib/authContext";

export default function RequireAuth() {
    const { session, loading } = useContext(AuthContext) as { session: unknown; loading: boolean };

  if (loading) {
    return null;
}

 if (!session) {
    return <Navigate to="/login" replace />;
     }

  return <Outlet />;
}
