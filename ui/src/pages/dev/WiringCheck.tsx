import { useEffect, useMemo, useState } from "react";
import { actionRegistry } from "../../app/actionRegistry";
import { apiFetch } from "../../lib/apiClient";

type CheckStatus = "ok" | "missing" | "unauthorized" | "blocked" | "error";

type CheckResult = {
  id: string;
  route: string;
  endpoint: string;
  status: CheckStatus;
  statusCode?: number;
  message?: string;
};

function parseEndpoint(definition: string) {
  const [method, ...pathParts] = definition.trim().split(" ");
  const path = pathParts.join(" ");
  return { method: (method || "GET").toUpperCase(), path: path || "/api/health" };
}

async function probe(definition: string): Promise<Pick<CheckResult, "status" | "statusCode" | "message">> {
  const { method, path } = parseEndpoint(definition);
  try {
    const response = await apiFetch(path, { method: method === "GET" ? "HEAD" : method }, { throwOnError: false });

    if (response.status === 404) return { status: "missing", statusCode: 404, message: "Endpoint not found" };
    if (response.status === 401) return { status: "unauthorized", statusCode: 401, message: "Auth required (acceptable)" };
    if (response.status === 403) return { status: "unauthorized", statusCode: 403, message: "Forbidden (acceptable)" };
    if (response.ok) return { status: "ok", statusCode: response.status };
    return { status: "error", statusCode: response.status, message: response.statusText };
  } catch (error) {
    return {
      status: "blocked",
      message: error instanceof Error ? error.message : "Network/CORS blocked",
    };
  }
}

export default function WiringCheck() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);

  const runChecks = async () => {
    setRunning(true);
    const rows: CheckResult[] = [];
    for (const item of actionRegistry) {
      for (const endpoint of item.requiredApis) {
        const result = await probe(endpoint);
        rows.push({ id: item.id, route: item.route, endpoint, ...result });
      }
    }
    setResults(rows);
    setRunning(false);
  };

  useEffect(() => {
    runChecks();
  }, []);

  const summary = useMemo(() => {
    const total = results.length;
    const missing = results.filter((r) => r.status === "missing").length;
    const blocked = results.filter((r) => r.status === "blocked").length;
    const unauthorized = results.filter((r) => r.status === "unauthorized").length;
    const ok = results.filter((r) => r.status === "ok").length;
    return { total, missing, blocked, unauthorized, ok };
  }, [results]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dev Wiring Check</h1>
        <button className="rounded bg-slate-900 px-3 py-2 text-white" onClick={runChecks} disabled={running}>
          {running ? "Checking..." : "Re-run"}
        </button>
      </div>
      <p className="text-sm text-slate-600">
        OK: {summary.ok} · Missing: {summary.missing} · Unauthorized: {summary.unauthorized} · Blocked: {summary.blocked} · Total: {summary.total}
      </p>
      <div className="overflow-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-2">Action</th><th className="p-2">Route</th><th className="p-2">Endpoint</th><th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={`${result.id}-${result.endpoint}`} className="border-t">
                <td className="p-2">{result.id}</td>
                <td className="p-2">{result.route}</td>
                <td className="p-2">{result.endpoint}</td>
                <td className="p-2">
                  {result.status === "ok" && "✅ OK"}
                  {result.status === "missing" && "❌ Missing endpoint (404)"}
                  {result.status === "unauthorized" && "❌ Unauthorized (401/403)"}
                  {result.status === "blocked" && "❌ CORS/Blocked"}
                  {result.status === "error" && `❌ Error (${result.statusCode ?? "n/a"})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
