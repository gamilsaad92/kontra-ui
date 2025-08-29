import React from "react";
import { Routes, Route, Navigate, useInRouterContext, Outlet } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import KontraDashboard from "./pages/KontraDashboard";

function RouterTripwire({ name }) {
  const inside = useInRouterContext();
  if (!inside) console.error(`[RouterTripwire] ${name} is rendering OUTSIDE <Router>`);
  return null;
}

export default function App() {
  return (
    <>
      <RouterTripwire name="App" />
      <Routes>
        <Route
          element={
            <>
              <header className="p-2 flex justify-end">
                <SignedIn>
                  <UserButton />
                </SignedIn>
                <SignedOut>
                  <SignInButton />
                </SignedOut>
              </header>
              <Outlet />
            </>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard/*" element={<KontraDashboard />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </>
  );
}
