import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App"; // resolves ./App.jsx automatically
import "./index.css";
import { QueryClientProvider } from "./lib/queryClient";
import { ClerkProvider } from "@clerk/clerk-react";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  // This will show in the console locally and on Vercel logs if the env var is missing
  console.error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <QueryClientProvider>
        <App />
      </QueryClientProvider>
    </ClerkProvider>
  </React.StrictMode>
);
