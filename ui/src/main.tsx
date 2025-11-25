// ui/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { installAuthFetchInterceptor } from "./lib/http";
import { AuthProvider } from "./lib/authContext";
import { Web3Provider } from "./providers/Web3Provider";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

installAuthFetchInterceptor();

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
