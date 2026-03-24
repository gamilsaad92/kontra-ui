import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ErrorBoundary from "./app/ErrorBoundary";
import { AuthProvider } from "./lib/authContext";
import { QueryClientProvider } from "./lib/queryClient";
import { installApiFetchInterceptor } from "./lib/apiClient";
import { Web3Provider } from "./providers/Web3Provider";
import "./index.css";

function FatalStartup({ error }: { error: unknown }) {
  return (
    <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>Kontra failed to start</h1>
      <pre style={{ whiteSpace: "pre-wrap" }}>
        {error instanceof Error ? error.stack || error.message : String(error)}
      </pre>
    </div>
  );
}

installApiFetchInterceptor();

try {
  const rootEl = document.getElementById("root");
  if (!rootEl) throw new Error("Missing #root element in index.html");

  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <BrowserRouter>
        <ErrorBoundary>
          <QueryClientProvider>
            <Web3Provider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </Web3Provider>
          </QueryClientProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </React.StrictMode>,
  );
} catch (error) {
  const rootEl = document.getElementById("root") || document.body;
  ReactDOM.createRoot(rootEl).render(<FatalStartup error={error} />);
}
