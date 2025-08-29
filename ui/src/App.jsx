import { Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import KontraDashboard from "./pages/KontraDashboard";

export default function App() {
  return (
    <Routes>
      {/* Default → dashboard */}
      <Route index element={<Navigate to="/dashboard" replace />} />

      {/* Auth (optional, only if you render Clerk components here) */}
      {/* <Route path="/sign-in" element={<SignIn routing="path" path="/sign-in" />} />
      <Route path="/sign-up" element={<SignUp routing="path" path="/sign-up" />} /> */}

      {/* Protected Dashboard */}
      <Route
        path="/dashboard/*"
        element={
          <>
            <SignedIn>
              <KontraDashboard />
            </SignedIn>
            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>
          </>
        }
      />
    </Routes>
  );
}
