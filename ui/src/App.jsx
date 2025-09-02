import { Routes, Route, Navigate } from "react-router-dom";
import SaasDashboard from "./pages/SaasDashboard";

export default function App() {
  return (
    <Routes>
      {/* Default → dashboard */}
      <Route index element={<Navigate to="/dashboard" replace />} />

      {/* Auth (optional, only if you render Clerk components here) */}
      {/* <Route path="/sign-in" element={<SignIn routing="path" path="/sign-in" />} />
      <Route path="/sign-up" element={<SignUp routing="path" path="/sign-up" />} /> */}

      {/* Dashboard */}
     <Route path="/dashboard" element={<SaasDashboard />} />
    </Routes>
  );
}
