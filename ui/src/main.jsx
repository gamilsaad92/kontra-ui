import React from "react";
import ReactDOM from "react-dom/client";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  useUser,
} from "@clerk/clerk-react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthContext } from "./lib/authContext";
import { supabase } from "./lib/supabaseClient";

const queryClient = new QueryClient();
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
if (!clerkKey) {
  console.error("Missing VITE_CLERK_PUBLISHABLE_KEY. Add it to ui/.env");
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const session = user ? { user } : null;
  return (
    <AuthContext.Provider value={{ session, supabase }}>
      {children}
    </AuthContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkKey}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SignedIn>
            <AuthProvider>
              <App />
            </AuthProvider>
          </SignedIn>
          <SignedOut>
            <SignIn />
          </SignedOut>
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  </React.StrictMode>,
);
