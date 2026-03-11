import React, { useContext } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import SaasDashboard from "./pages/SaasDashboard";
import RequireAuth from "./app/guards/RequireAuth";
import { AuthContext, AuthProvider } from "./lib/authContext";

function LoadingScreen() {
  return <div style={{ padding: 24 }}>Loading Kontra...</div>;
}

function AppRoutes() {
  const { loading, session } = useContext(AuthContext);
  const isAuthenticated = Boolean(session?.access_token);

  if (loading) return <LoadingScreen />;

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth loading={loading} session={session}>
               {isAuthenticated ? <SaasDashboard /> : <Navigate to="/login" replace />}
            </RequireAuth>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
   return (
         <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
