// ui/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { installApiFetchInterceptor } from "./lib/apiClient";
import { AuthProvider } from "./lib/authContext";
import { LocaleProvider } from "./lib/i18n";
import { Web3Provider } from "./providers/Web3Provider";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

installApiFetchInterceptor();

if (typeof window !== "undefined") {
    const isIgnorableBrowserNoise = (message: string) => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("signal is aborted") ||
      normalized.includes("the user aborted a request") ||
      normalized.includes("resizeobserver loop")
    );
  };

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { name?: string; message?: string } | undefined;
    const message = reason?.message ?? "";
     if (reason?.name === "AbortError" || isIgnorableBrowserNoise(message)) {
      event.preventDefault();
    }
  });

  window.addEventListener("error", (event) => {
    const message = event.message ?? "";
    if (isIgnorableBrowserNoise(message)) {
      event.preventDefault();
    }
  });
  
  window.addEventListener("api:error", (event: Event) => {
    const detail = (event as CustomEvent<{ code?: string; message?: string }>).detail;
    if (detail?.code === "ORG_CONTEXT_MISSING") {
      window.location.assign("/organizations");
            return;
    }
       const message = detail?.message ?? "Request failed";
    window.alert(message);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LocaleProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <Web3Provider>
              <BrowserRouter>
              <App />
            </BrowserRouter>
          </Web3Provider>
        </QueryClientProvider>
      </AuthProvider>
    </LocaleProvider>
  </React.StrictMode>
);
