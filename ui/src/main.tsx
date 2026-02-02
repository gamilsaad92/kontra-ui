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
