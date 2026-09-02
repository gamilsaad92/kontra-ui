import React, { useEffect, useState } from "react";
import { api, getApiBaseUrl, getRequestLog, subscribeApiLog } from "../../lib/apiClient";
import { apiRoutes } from "../../lib/apiRoutes";

const emptyResult = { status: "idle", data: null, error: null };

export default function ApiDiagnostics() {
  const [health, setHealth] = useState(emptyResult);
  const [whoami, setWhoami] = useState(emptyResult);
  const [logs, setLogs] = useState(getRequestLog());

  useEffect(() => {
    const unsubscribe = subscribeApiLog(() => {
      setLogs(getRequestLog());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;

    const runChecks = async () => {
      setHealth({ status: "loading", data: null, error: null });
      try {
        const { data } = await api.get(apiRoutes.health);
        if (active) {
          setHealth({ status: "success", data, error: null });
        }
      } catch (error) {
        if (active) {
          setHealth({ status: "error", data: null, error });
        }
      }

      setWhoami({ status: "loading", data: null, error: null });
      try {
        const { data } = await api.get(apiRoutes.whoami, { requireAuth: true });
        if (active) {
          setWhoami({ status: "success", data, error: null });
        }
      } catch (error) {
        if (active) {
          setWhoami({ status: "error", data: null, error });
        }
      }
    };

    runChecks();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">API Diagnostics</h1>
        <p className="text-sm text-slate-500">
          Use this panel to confirm base URL, health checks, auth, and recent requests.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Environment</h2>
        <div className="mt-2 text-sm text-slate-600">
          <div>
            <span className="font-medium text-slate-700">Base URL:</span> {getApiBaseUrl() || "Not set"}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Health</h2>
          <pre className="mt-2 text-xs text-slate-600 whitespace-pre-wrap">
            {health.status === "loading" && "Loading..."}
            {health.status === "success" && JSON.stringify(health.data, null, 2)}
            {health.status === "error" &&
              `Error: ${health.error?.message || "Unknown error"}`}
          </pre>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Who Am I</h2>
          <pre className="mt-2 text-xs text-slate-600 whitespace-pre-wrap">
            {whoami.status === "loading" && "Loading..."}
            {whoami.status === "success" && JSON.stringify(whoami.data, null, 2)}
            {whoami.status === "error" &&
              `Error: ${whoami.error?.message || "Unknown error"}`}
          </pre>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Recent Requests</h2>
        <div className="mt-3 space-y-2 text-xs text-slate-600">
          {logs.length === 0 && <p>No requests yet.</p>}
          {logs
            .slice()
            .reverse()
            .slice(0, 20)
            .map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <span className="font-medium text-slate-700">
                  {entry.method} {entry.url}
                </span>
                <span>
                  {entry.status ?? "pending"} · {entry.durationMs ?? "-"}ms{" "}
                  {entry.ok === false ? "· error" : ""}
                </span>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
