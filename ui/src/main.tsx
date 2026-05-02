import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { AuthProvider } from "./lib/authContext";
import { QueryClientProvider } from "./lib/queryClient";
import { Web3Provider } from "./providers/Web3Provider";
import "./index.css";

// Dismiss the inline splash screen from index.html once React has mounted
function dismissSplash() {
  const splash = document.getElementById("kontra-splash");
  if (!splash) return;
  splash.classList.add("ks-out");
  setTimeout(() => splash.remove(), 400);
}

// Hook component that fires dismissSplash after first paint
function SplashDismisser() {
  React.useEffect(() => { dismissSplash(); }, []);
  return null;
}

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
                <SplashDismisser />
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
