import { useEffect, useMemo, useState } from "react";
import { actionRegistry, type Severity } from "../../app/actionRegistry";
import { routeCatalog } from "../../app/routes";
import { apiFetch } from "../../lib/apiClient";

type CheckStatus = "ok" | "missing" | "unauthorized" | "cors" | "failed" | "route-missing";

type CheckResult = {
  id: string;
  label: string;
  route: string;
  severity: Severity;
  target: string;
  status: CheckStatus;
  statusCode?: number;
  message?: string;
};

function parseEndpoint(definition: string) {
  const [method, ...pathParts] = definition.trim().split(" ");
  const normalizedMethod = (method || "GET").toUpperCase();
  const path = pathParts.join(" ").replace(/:[^/]+/g, "00000000-0000-0000-0000-000000000000") || "/api/health";
  return { method: normalizedMethod, path };
}

sync function probeApi(definition: string): Promise<Pick<CheckResult, "status" | "statusCode" | "message">> {
  const { method, path } = parseEndpoint(definition);

    try {
    const response = await apiFetch(path, { method }, { throwOnError: false });
    if (response.status === 404) return { status: "missing", statusCode: 404, message: "Endpoint not found" };
      if (response.status === 501) return { status: "failed", statusCode: 501, message: "Not implemented" };
    if (response.status === 400) {
      const body = await response.clone().json().catch(() => null);
      if (body?.code === "ORG_CONTEXT_MISSING") {
        return { status: "failed", statusCode: 400, message: "ORG_CONTEXT_MISSING" };
      }
    }
    if (response.status === 401 || response.status === 403) {
      return { status: "unauthorized", statusCode: response.status, message: "Auth required" };
    }
    if (response.ok) return { status: "ok", statusCode: response.status };
   
    return { status: "failed", statusCode: response.status, message: response.statusText };
  } catch (error) {
    return {
    status: "cors",
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
            for (const requiredRoute of item.requiredRoutes ?? []) {
        if (!routeCatalog.includes(requiredRoute as never)) {
          rows.push({
            id: item.id,
            label: item.label,
            route: item.route,
            severity: item.severity,
            target: requiredRoute,
            status: "route-missing",
            message: "Route not declared in route catalog",
          });
        }
      }

        for (const endpoint of item.requiredApis) {
        const result = await probeApi(endpoint);
        rows.push({
          id: item.id,
          label: item.label,
          route: item.route,
          severity: item.severity,
          target: endpoint,
          ...result,
        });
      }
    }
  
    setResults(rows);
    setRunning(false);
  };

  useEffect(() => {
    runChecks();
  }, []);

  const summary = useMemo(() => {
    const failures = results.filter((r) => r.status !== "ok" && r.status !== "unauthorized");
    const blockerHigh = failures.filter((r) => r.severity === "blocker" || r.severity === "high");
    return {
      total: results.length,
      ok: results.filter((r) => r.status === "ok").length,
      failures: failures.length,
      blockerHigh: blockerHigh.length,
    };
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
        OK: {summary.ok} · Failures: {summary.failures} · Blocker/High Failures: {summary.blockerHigh} · Total: {summary.total}
      </p>
      <div className="overflow-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
             <th className="p-2">Action</th>
              <th className="p-2">Severity</th>
              <th className="p-2">Route</th>
              <th className="p-2">Target</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
                <tr key={`${result.id}-${result.target}`} className="border-t">
                <td className="p-2">{result.label}</td>
                <td className="p-2 uppercase">{result.severity}</td>
                <td className="p-2">{result.route}</td>
                  <td className="p-2">{result.target}</td>
                <td className="p-2">{result.status}{result.message ? `: ${result.message}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
