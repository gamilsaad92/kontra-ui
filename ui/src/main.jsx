import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY!;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/" signInUrl="/sign-in" signUpUrl="/sign-up">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>
);
