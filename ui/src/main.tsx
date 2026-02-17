// ui/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { installApiFetchInterceptor } from "./lib/apiClient";
import { AuthProvider } from "./lib/authContext";
import { Web3Provider } from "./providers/Web3Provider";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

installApiFetchInterceptor();

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { name?: string; message?: string } | undefined;
    const message = reason?.message ?? "";
    if (reason?.name === "AbortError" || message.includes("signal is aborted")) {
      event.preventDefault();
    }
  });
  let currentOrgId: string | null = null;

export function setOrgId(orgId?: string | number | null): void {
  currentOrgId = orgId === null || orgId === undefined || orgId === "" ? null : String(orgId);

  if (typeof window !== "undefined") {
    if (currentOrgId) {
      window.localStorage.setItem("kontra:orgId", currentOrgId);
      window.sessionStorage.setItem("kontra:orgId", currentOrgId);
    } else {
      window.localStorage.removeItem("kontra:orgId");
      window.sessionStorage.removeItem("kontra:orgId");
    }
  }
}

export function getOrgId(): string | null {
  if (currentOrgId) {
    return currentOrgId;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const fromStorage =
    window.localStorage.getItem("kontra:orgId") ||
    window.sessionStorage.getItem("kontra:orgId");

  return fromStorage && fromStorage.trim() ? fromStorage : null;
}

export function requireOrgId(): string {
  const orgId = getOrgId();
  if (!orgId) {
    const error = new Error("Select an organization to continue") as Error & {
      code?: string;
      status?: number;
    };
    error.code = "ORG_CONTEXT_MISSING";
    error.status = 400;
    throw error;
  }

  return orgId;
}

}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
   <AuthProvider>
      <QueryClientProvider client={queryClient}>
          <Web3Provider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </Web3Provider>
      </QueryClientProvider>
    </AuthProvider>
  </React.StrictMode>
);
