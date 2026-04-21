import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  CpuChipIcon,
  BoltIcon,
  GlobeAltIcon,
  PuzzlePieceIcon,
  KeyIcon,
  CodeBracketIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  SparklesIcon,
  ServerIcon,
  BeakerIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  TrashIcon,
  PlusIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowRightIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  Cog6ToothIcon,
  CloudArrowUpIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Webhook {
  id: string; url: string; description?: string; events: string[];
  active: boolean; deliveries: number; failures: number; lastDeliveredAt?: string; createdAt: string;
}

interface ApiKey {
  id: string; name: string; key: string; scopes: string[]; active: boolean; createdAt: string; lastUsedAt?: string;
}

interface EventEntry {
  id: string; type: string; data: Record<string, any>; orgId?: string; source?: string; timestamp: string;
}

interface Plugin {
  id: string; name: string; category: string; description: string; authType: string; authLabel?: string;
  tier: string; popular: boolean; actions: { id: string; name: string; description: string }[];
}

interface InstalledPlugin {
  installId: string; connectorId: string; label: string; status: string; name?: string; category?: string;
  installedAt: string; executionCount: number; lastExecutedAt?: string;
}

interface ModelStats {
  totalCalls: number; successCalls: number; failedCalls: number; totalCostUsd: number; avgLatencyMs: number;
  byProvider: Record<string, { calls: number; cost: number; avgLatency: number }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORG_HEADER = { "X-Org-Id": "demo-org", "Content-Type": "application/json" };

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    credentials: "include",
    headers: { ...ORG_HEADER, ...(opts.headers as any) },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  return res.json();
}

const PROVIDER_COLORS: Record<string, string> = {
  openai:       "bg-emerald-100 text-emerald-700",
  azure_openai: "bg-blue-100 text-blue-700",
  anthropic:    "bg-violet-100 text-violet-700",
  bedrock:      "bg-amber-100 text-amber-700",
  ollama:       "bg-gray-100 text-gray-700",
};

const CATEGORY_COLORS: Record<string, string> = {
  Notifications:       "bg-blue-100 text-blue-700",
  CRM:                 "bg-indigo-100 text-indigo-700",
  "Project Management":"bg-violet-100 text-violet-700",
  ITSM:                "bg-amber-100 text-amber-700",
  eSignature:          "bg-emerald-100 text-emerald-700",
  Communications:      "bg-cyan-100 text-cyan-700",
  Alerting:            "bg-red-100 text-red-700",
  "Data Pipeline":     "bg-teal-100 text-teal-700",
};

const EVENT_COLORS: Record<string, string> = {
  "loan.":      "bg-blue-100 text-blue-700",
  "draw.":      "bg-amber-100 text-amber-700",
  "agent.":     "bg-violet-100 text-violet-700",
  "policy.":    "bg-red-100 text-red-700",
  "document.":  "bg-emerald-100 text-emerald-700",
  "token.":     "bg-indigo-100 text-indigo-700",
  "inspection.":"bg-orange-100 text-orange-700",
  "webhook.":   "bg-gray-100 text-gray-600",
};

function eventColor(type: string) {
  for (const [prefix, cls] of Object.entries(EVENT_COLORS)) {
    if (type.startsWith(prefix)) return cls;
  }
  return "bg-gray-100 text-gray-600";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Model Router Panel ────────────────────────────────────────────────────────

function ModelRouterPanel() {
  const [providers, setProviders] = useState<any[]>([]);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [prompt, setPrompt] = useState("Summarize a commercial real estate loan with a 1.22 DSCR, 72% LTV on a multifamily property in Miami FL. Flag any risk indicators.");
  const [task, setTask] = useState("summarize");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [auditLog, setAuditLog] = useState<any[]>([]);

  useEffect(() => {
    apiFetch("/models").then((d) => setProviders(d.providers || [])).catch(() => {});
    apiFetch("/models/stats").then(setStats).catch(() => {});
    apiFetch("/models/audit?limit=10").then(setAuditLog).catch(() => {});
  }, []);

  const runCompletion = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch("/complete", {
        method: "POST",
        body: JSON.stringify({ task, prompt, provider: selectedProvider || undefined }),
      });
      setResult(res);
      apiFetch("/models/stats").then(setStats).catch(() => {});
      apiFetch("/models/audit?limit=10").then(setAuditLog).catch(() => {});
    } catch (err: any) {
      setResult({ error: err.message || "Request failed" });
    }
    setLoading(false);
  };

  const TASKS = ["default","classify","extract","summarize","policy_eval","agent_decision","email_parse","risk_score"];

  return (
    <div className="space-y-5">
      {/* Provider grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(providers.length ? providers : [
          { id: "openai", defaultModel: "gpt-4o-mini", available: true },
          { id: "azure_openai", defaultModel: "gpt-4o-mini", available: false },
          { id: "anthropic", defaultModel: "claude-3-haiku", available: false },
          { id: "bedrock", defaultModel: "claude-3-haiku", available: false },
          { id: "ollama", defaultModel: "llama3.2:3b", available: false },
        ]).map((p: any) => (
          <button
            key={p.id}
            onClick={() => setSelectedProvider(selectedProvider === p.id ? "" : p.id)}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedProvider === p.id ? "border-[#800020] bg-[#800020]/5 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${PROVIDER_COLORS[p.id] || "bg-gray-100 text-gray-600"}`}>{p.id.replace("_", " ")}</span>
              <div className={`w-2 h-2 rounded-full ${p.available ? "bg-emerald-400" : "bg-gray-200"}`} />
            </div>
            <p className="text-xs font-mono text-gray-600 truncate">{p.defaultModel}</p>
            {selectedProvider === p.id && <p className="text-xs text-[#800020] font-semibold mt-1">Selected ✓</p>}
          </button>
        ))}
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Calls",   value: stats.totalCalls       },
            { label: "Success Rate",  value: stats.totalCalls ? `${Math.round(stats.successCalls / stats.totalCalls * 100)}%` : "—" },
            { label: "Avg Latency",   value: stats.avgLatencyMs ? `${Math.round(stats.avgLatencyMs)}ms` : "—" },
            { label: "Est. Cost",     value: `$${stats.totalCostUsd.toFixed(4)}` },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
              <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
              <p className="text-lg font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Playground */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Model Playground</p>
        <div className="flex gap-2 mb-3">
          <select
            value={task}
            onChange={(e) => setTask(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30 bg-white"
          >
            {TASKS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {selectedProvider && (
            <span className={`flex items-center px-3 py-2 rounded-lg text-xs font-bold ${PROVIDER_COLORS[selectedProvider]}`}>
              via {selectedProvider.replace("_", " ")}
            </span>
          )}
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30 font-mono resize-y mb-3"
          placeholder="Enter a prompt..."
        />
        <button
          onClick={runCompletion}
          disabled={loading || !prompt.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#800020] text-white text-sm font-semibold rounded-lg hover:bg-[#6a001a] disabled:opacity-40 transition-colors"
        >
          {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <PaperAirplaneIcon className="w-4 h-4" />}
          {loading ? "Routing..." : "Run Inference"}
        </button>

        {result && (
          <div className={`mt-4 p-4 rounded-xl border text-sm font-mono whitespace-pre-wrap ${result.error ? "bg-red-50 border-red-100 text-red-700" : "bg-gray-50 border-gray-100 text-gray-800"}`}>
            {result.error ? result.error : (
              <div className="space-y-2">
                <div className="flex gap-3 text-xs mb-2 not-prose">
                  {[["provider", result.provider], ["model", result.model], ["latency", `${result.latencyMs}ms`], ["cost", `$${result.costUsd?.toFixed(6)}`]].map(([k, v]) => (
                    <span key={k as string} className="px-2 py-0.5 bg-white rounded border border-gray-200 font-sans"><span className="text-gray-400">{k}:</span> <span className="font-semibold text-gray-700">{String(v)}</span></span>
                  ))}
                </div>
                <div className="pt-2 border-t border-gray-200 font-sans text-sm text-gray-800">{result.content}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audit log */}
      {auditLog.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-bold text-gray-700">Recent Inference Calls</p>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-100">{["Provider","Model","Task","Latency","Cost","Status","Time"].map(h => <th key={h} className="text-left font-semibold text-gray-500 px-4 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {auditLog.map((l: any, i: number) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2"><span className={`px-1.5 py-0.5 rounded font-semibold ${PROVIDER_COLORS[l.provider] || "bg-gray-100 text-gray-600"}`}>{l.provider}</span></td>
                  <td className="px-4 py-2 font-mono text-gray-600">{l.model}</td>
                  <td className="px-4 py-2 text-gray-600">{l.task}</td>
                  <td className="px-4 py-2 text-gray-700">{l.latencyMs ? `${l.latencyMs}ms` : "—"}</td>
                  <td className="px-4 py-2 text-gray-700">{l.costUsd != null ? `$${Number(l.costUsd).toFixed(6)}` : "—"}</td>
                  <td className="px-4 py-2">{l.success ? <span className="text-emerald-600 font-semibold">OK</span> : <span className="text-red-600 font-semibold">ERR</span>}</td>
                  <td className="px-4 py-2 text-gray-400">{timeAgo(l.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Webhook Manager ───────────────────────────────────────────────────────────

function WebhookManager() {
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ url: "", description: "", events: "*", secret: "" });
  const [showForm, setShowForm] = useState(false);
  const [pingStatus, setPingStatus] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [h, e] = await Promise.allSettled([apiFetch("/webhooks"), apiFetch("/events?limit=20")]);
    if (h.status === "fulfilled") setHooks(h.value);
    if (e.status === "fulfilled") setEvents(e.value);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const register = async () => {
    if (!form.url) return;
    try {
      await apiFetch("/webhooks", {
        method: "POST",
        body: JSON.stringify({ url: form.url, description: form.description, events: form.events.split(",").map(s => s.trim()).filter(Boolean), secret: form.secret || undefined }),
      });
      setForm({ url: "", description: "", events: "*", secret: "" });
      setShowForm(false);
      load();
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  const deleteHook = async (id: string) => {
    await apiFetch(`/webhooks/${id}`, { method: "DELETE" });
    load();
  };

  const ping = async (id: string) => {
    setPingStatus(s => ({ ...s, [id]: "pinging" }));
    try {
      await apiFetch(`/webhooks/${id}/ping`, { method: "POST" });
      setPingStatus(s => ({ ...s, [id]: "ok" }));
    } catch {
      setPingStatus(s => ({ ...s, [id]: "error" }));
    }
    setTimeout(() => setPingStatus(s => { const n = { ...s }; delete n[id]; return n; }), 3000);
  };

  const emitEvent = async (type: string) => {
    await apiFetch("/events/emit", { method: "POST", body: JSON.stringify({ type, data: { demo: true, timestamp: new Date().toISOString(), loan_id: "LN-0094" } }) });
    setTimeout(load, 400);
  };

  const CANONICAL_EVENTS = ["loan.updated","draw.approved","draw.rejected","inspection.completed","policy.violation","agent.action","document.extracted","token.issued","agent.escalation"];

  return (
    <div className="space-y-5">
      {/* Quick emit */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fire a Test Event</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CANONICAL_EVENTS.map((type) => (
            <button key={type} onClick={() => emitEvent(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border border-transparent transition-all hover:shadow-sm ${eventColor(type)}`}>
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Register form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-[#800020]/20 shadow-sm p-5">
          <p className="text-sm font-bold text-gray-900 mb-4">Register New Webhook</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://your-server.com/webhook" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30" />
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30" />
            <input value={form.events} onChange={e => setForm(f => ({ ...f, events: e.target.value }))} placeholder="Event types, comma-separated (or *)" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30" />
            <input value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} placeholder="HMAC secret (optional)" type="password" className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30" />
          </div>
          <div className="flex gap-2">
            <button onClick={register} className="px-5 py-2 bg-[#800020] text-white text-sm font-semibold rounded-lg hover:bg-[#6a001a]">Register</button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">{hooks.length} Registered Webhooks</p>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 bg-[#800020] text-white text-sm font-semibold rounded-lg hover:bg-[#6a001a] transition-colors">
          <PlusIcon className="w-4 h-4" /> Register Webhook
        </button>
      </div>

      <div className="space-y-3">
        {hooks.map((hook) => (
          <div key={hook.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className={`w-2 h-2 rounded-full ${hook.active ? "bg-emerald-400" : "bg-gray-300"}`} />
                  <p className="text-sm font-bold text-gray-900 truncate">{hook.description || hook.url}</p>
                </div>
                <p className="text-xs font-mono text-gray-500 truncate">{hook.url}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => ping(hook.id)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${pingStatus[hook.id] === "ok" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : pingStatus[hook.id] === "error" ? "bg-red-100 text-red-700 border-red-200" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  {pingStatus[hook.id] === "pinging" ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin inline" /> : pingStatus[hook.id] === "ok" ? "Pinged ✓" : pingStatus[hook.id] === "error" ? "Failed ✗" : "Ping"}
                </button>
                <button onClick={() => deleteHook(hook.id)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-100 text-red-600 hover:bg-red-50 transition-all">
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {hook.events.map((e) => <span key={e} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${eventColor(e)}`}>{e}</span>)}
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              <span><span className="font-semibold text-gray-700">{hook.deliveries}</span> delivered</span>
              <span><span className={`font-semibold ${hook.failures > 0 ? "text-red-600" : "text-gray-700"}`}>{hook.failures}</span> failed</span>
              {hook.lastDeliveredAt && <span>Last: {timeAgo(hook.lastDeliveredAt)}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Recent events */}
      {events.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-bold text-gray-700">Recent Events ({events.length})</p>
          </div>
          <div className="divide-y divide-gray-50">
            {events.map((e) => (
              <div key={e.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/50">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 mt-0.5 ${eventColor(e.type)}`}>{e.type}</span>
                <span className="text-xs font-mono text-gray-600 truncate flex-1">{JSON.stringify(e.data)}</span>
                <span className="text-xs text-gray-400 shrink-0">{timeAgo(e.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Plugin Marketplace ────────────────────────────────────────────────────────

function PluginMarketplace() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [execResult, setExecResult] = useState<Record<string, any>>({});
  const [filterCat, setFilterCat] = useState("all");

  useEffect(() => {
    Promise.allSettled([apiFetch("/plugins"), apiFetch("/plugins/installed")]).then(([p, i]) => {
      if (p.status === "fulfilled") setPlugins(p.value);
      if (i.status === "fulfilled") setInstalled(i.value);
    });
  }, []);

  const installPlugin = async (connectorId: string) => {
    setInstalling(connectorId);
    try {
      await apiFetch("/plugins/install", { method: "POST", body: JSON.stringify({ connectorId, credentials: { api_key: "demo" }, label: plugins.find(p => p.id === connectorId)?.name }) });
      const updated = await apiFetch("/plugins/installed");
      setInstalled(updated);
    } catch (err: any) { alert(err.message); }
    setInstalling(null);
  };

  const executeAction = async (installId: string, actionId: string) => {
    setExecuting(installId);
    try {
      const result = await apiFetch(`/plugins/install/${installId}/execute`, {
        method: "POST",
        body: JSON.stringify({ actionId, payload: { channel: "#kontra-alerts", text: "Kontra test execution — draw approved for LN-0094 ($82,000)", summary: "Kontra test", severity: "info", to: "test@example.com", subject: "Kontra Integration Test", text: "Test message from Kontra" } }),
      });
      setExecResult(r => ({ ...r, [installId]: result }));
    } catch (err: any) { setExecResult(r => ({ ...r, [installId]: { error: err.message } })); }
    setExecuting(null);
  };

  const categories = ["all", ...Array.from(new Set(plugins.map(p => p.category)))];
  const filtered = filterCat === "all" ? plugins : plugins.filter(p => p.category === filterCat);
  const installedIds = new Set(installed.map(i => i.connectorId));

  return (
    <div className="space-y-5">
      {/* Installed */}
      {installed.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Installed Connectors ({installed.length})</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {installed.map((inst) => (
              <div key={inst.installId} className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold text-gray-900">{inst.label}</p>
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${CATEGORY_COLORS[inst.category || ""] || "bg-gray-100 text-gray-600"}`}>{inst.category}</span>
                <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                  <p>{inst.executionCount} executions</p>
                  {inst.lastExecutedAt && <p>Last: {timeAgo(inst.lastExecutedAt)}</p>}
                </div>
                <button
                  onClick={() => executeAction(inst.installId, plugins.find(p => p.id === inst.connectorId)?.actions[0]?.id || "post_message")}
                  disabled={executing === inst.installId}
                  className="mt-3 w-full py-1.5 text-xs font-semibold bg-white border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 disabled:opacity-40 transition-colors"
                >
                  {executing === inst.installId ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}
                  Test Execute
                </button>
                {execResult[inst.installId] && (
                  <pre className="mt-2 text-xs font-mono bg-white rounded p-2 border border-emerald-100 overflow-auto max-h-20">
                    {JSON.stringify(execResult[inst.installId], null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        {categories.map((c) => (
          <button key={c} onClick={() => setFilterCat(c)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all capitalize ${filterCat === c ? "bg-[#800020] text-white" : "bg-white border border-gray-200 text-gray-500 hover:border-gray-400"}`}>
            {c === "all" ? "All Connectors" : c}
          </button>
        ))}
      </div>

      {/* Plugin grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {filtered.map((plugin) => {
          const isInstalled = installedIds.has(plugin.id);
          return (
            <div key={plugin.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-gray-900 leading-tight">{plugin.name}</p>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold mt-0.5 inline-block ${CATEGORY_COLORS[plugin.category] || "bg-gray-100 text-gray-600"}`}>{plugin.category}</span>
                </div>
                {plugin.popular && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-bold">Popular</span>}
              </div>
              <p className="text-xs text-gray-500 mb-3 line-clamp-3">{plugin.description}</p>
              <div className="flex flex-wrap gap-1 mb-3">
                {plugin.actions.slice(0, 2).map((a) => <span key={a.id} className="text-xs bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5 text-gray-600">{a.name}</span>)}
                {plugin.actions.length > 2 && <span className="text-xs text-gray-400">+{plugin.actions.length - 2}</span>}
              </div>
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${plugin.tier === "enterprise" ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-600"}`}>{plugin.tier}</span>
                <button
                  onClick={() => !isInstalled && installPlugin(plugin.id)}
                  disabled={isInstalled || installing === plugin.id}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${isInstalled ? "bg-emerald-100 text-emerald-700" : "bg-[#800020] text-white hover:bg-[#6a001a] disabled:opacity-40"}`}
                >
                  {installing === plugin.id ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin inline" /> : isInstalled ? "Installed ✓" : "Install"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── API Key Manager ───────────────────────────────────────────────────────────

function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("New Integration Key");
  const [loading, setLoading] = useState(false);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  useEffect(() => { apiFetch("/api-keys").then(setKeys).catch(() => {}); }, []);

  const create = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api-keys", { method: "POST", body: JSON.stringify({ name: keyName }) });
      setNewKey(res.key);
      setKeys([...keys, { ...res, key: `${res.key.slice(0, 14)}${"•".repeat(20)}` }]);
      setKeyName("New Integration Key");
    } catch (err: any) { alert(err.message); }
    setLoading(false);
  };

  const revoke = async (id: string) => {
    await apiFetch(`/api-keys/${id}`, { method: "DELETE" });
    setKeys(keys.map(k => k.id === id ? { ...k, active: false } : k));
  };

  return (
    <div className="space-y-5">
      {newKey && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div className="flex items-start gap-2">
            <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-800 mb-1">API Key created — copy it now, it won't be shown again.</p>
              <code className="block text-xs font-mono bg-white border border-emerald-100 rounded px-3 py-2 text-emerald-900 break-all">{newKey}</code>
              <button onClick={() => setNewKey(null)} className="mt-2 text-xs text-emerald-700 hover:underline font-semibold">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Create New API Key</p>
        <div className="flex gap-2">
          <input
            value={keyName}
            onChange={e => setKeyName(e.target.value)}
            placeholder="Key name"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800020]/30"
          />
          <button onClick={create} disabled={loading} className="flex items-center gap-2 px-5 py-2 bg-[#800020] text-white text-sm font-semibold rounded-lg hover:bg-[#6a001a] disabled:opacity-40">
            {loading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
            Create
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Keys use HMAC-SHA256 for webhook signatures. Scopes control endpoint access. Rotate quarterly.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {["Name","Key","Scopes","Status","Created","Last Used",""].map(h => <th key={h} className="text-left font-semibold text-gray-500 px-4 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-semibold text-gray-800">{k.name}</td>
                <td className="px-4 py-3 font-mono text-gray-500">{showValues[k.id] ? k.key : `${k.key.slice(0, 14)}${"•".repeat(16)}`}</td>
                <td className="px-4 py-3">{(k.scopes || ["*"]).map(s => <span key={s} className="mr-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-mono">{s}</span>)}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full font-semibold ${k.active !== false ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500 line-through"}`}>{k.active !== false ? "Active" : "Revoked"}</span></td>
                <td className="px-4 py-3 text-gray-500">{k.createdAt ? new Date(k.createdAt).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-gray-400">{k.lastUsedAt ? timeAgo(k.lastUsedAt) : "Never"}</td>
                <td className="px-4 py-3">
                  {k.active !== false && (
                    <button onClick={() => revoke(k.id)} className="px-2 py-1 text-xs font-semibold text-red-600 border border-red-100 rounded hover:bg-red-50">Revoke</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Security note */}
      <div className="p-4 bg-[#800020]/5 border border-[#800020]/15 rounded-xl flex items-start gap-3">
        <ShieldCheckIcon className="w-5 h-5 text-[#800020] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-[#800020]">Enterprise Key Security</p>
          <p className="text-xs text-gray-600 mt-0.5">In production, raw key values are hashed with SHA-256 before storage. Only the hash and prefix (first 14 chars) are persisted. Webhook deliveries are signed using HMAC-SHA256 with your key secret. Rotate keys quarterly or on personnel change.</p>
        </div>
      </div>
    </div>
  );
}

// ── OpenAPI Explorer ──────────────────────────────────────────────────────────

function OpenApiExplorer() {
  const [spec, setSpec] = useState<any>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => { apiFetch("/openapi").then(setSpec).catch(() => {}); }, []);

  if (!spec) return <div className="text-center py-12 text-gray-400 text-sm">Loading OpenAPI spec...</div>;

  const METHOD_COLORS: Record<string, string> = { get: "bg-blue-100 text-blue-700", post: "bg-emerald-100 text-emerald-700", put: "bg-amber-100 text-amber-700", patch: "bg-orange-100 text-orange-700", delete: "bg-red-100 text-red-700" };

  const paths = Object.entries(spec.paths || {}).flatMap(([path, methods]: any) =>
    Object.entries(methods).map(([method, op]: any) => ({ path, method, op }))
  );

  const byTag: Record<string, typeof paths> = {};
  for (const item of paths) {
    const tag = item.op.tags?.[0] || "Other";
    byTag[tag] = byTag[tag] || [];
    byTag[tag].push(item);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-gray-900 rounded-xl">
        <CodeBracketIcon className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-white">{spec.info.title} <span className="text-gray-400 font-mono text-xs">v{spec.info.version}</span></p>
          <p className="text-xs text-gray-400 mt-0.5">{spec.info.description}</p>
          <p className="text-xs text-gray-500 mt-1 font-mono">Base URL: <span className="text-emerald-400">{spec.servers?.[0]?.url}</span></p>
        </div>
      </div>

      {Object.entries(byTag).map(([tag, items]) => (
        <div key={tag} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <button
            onClick={() => setExpanded(e => ({ ...e, [tag]: !e[tag] }))}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left"
          >
            <p className="text-sm font-bold text-gray-900">{tag}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{items.length} endpoints</span>
              {expanded[tag] ? <ChevronDownIcon className="w-4 h-4 text-gray-400" /> : <ChevronRightIcon className="w-4 h-4 text-gray-400" />}
            </div>
          </button>
          {expanded[tag] && (
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {items.map(({ path, method, op }) => (
                <div key={`${method}-${path}`} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/50">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono uppercase shrink-0 ${METHOD_COLORS[method] || "bg-gray-100 text-gray-600"}`}>{method}</span>
                  <div>
                    <code className="text-xs font-mono text-gray-700">/api/v1{path}</code>
                    <p className="text-xs text-gray-500 mt-0.5">{op.summary}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── SSE Live Stream ───────────────────────────────────────────────────────────

function LiveStream() {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const pausedRef = useRef(false);

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close();
    const es = new EventSource(`${API_BASE}/api/v1/events/stream`);
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      if (pausedRef.current) return;
      try {
        const ev = JSON.parse(e.data);
        if (ev.type === "connected") return;
        setEvents(prev => [ev, ...prev].slice(0, 100));
      } catch {}
    };
  }, []);

  useEffect(() => { connect(); return () => esRef.current?.close(); }, [connect]);

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${connected ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
          {connected ? "Connected — SSE Live Stream" : "Disconnected"}
        </div>
        <button onClick={togglePause} className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${paused ? "bg-amber-100 text-amber-700 border-amber-200" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
          {paused ? "▶ Resume" : "⏸ Pause"}
        </button>
        <button onClick={() => setEvents([])} className="px-4 py-2 rounded-full text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50">Clear</button>
        {!connected && <button onClick={connect} className="px-4 py-2 rounded-full text-sm font-semibold bg-[#800020] text-white hover:bg-[#6a001a]">Reconnect</button>}
      </div>

      <div className="bg-gray-900 rounded-2xl overflow-hidden min-h-[400px] max-h-[600px] overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm font-mono">Waiting for events... emit one from the Webhooks tab.</div>
        ) : (
          <div className="divide-y divide-gray-800">
            {events.map((e) => (
              <div key={e.id} className="px-4 py-3 hover:bg-gray-800/50 font-mono text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${eventColor(e.type)}`}>{e.type}</span>
                  <span className="text-gray-500">{new Date(e.timestamp).toLocaleTimeString()}</span>
                  <span className="text-gray-600 text-xs">{e.id.slice(0, 8)}</span>
                </div>
                <pre className="text-gray-300 whitespace-pre-wrap text-xs leading-relaxed">{JSON.stringify(e.data, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EnterpriseApiPage() {
  const [activeTab, setActiveTab] = useState<"models" | "webhooks" | "plugins" | "keys" | "openapi" | "stream">("models");
  const [health, setHealth] = useState<any>(null);

  useEffect(() => { apiFetch("/health").then(setHealth).catch(() => {}); }, []);

  const TABS = [
    { id: "models",   label: "Model Router",    icon: CpuChipIcon      },
    { id: "webhooks", label: "Webhooks & Events",icon: BoltIcon         },
    { id: "plugins",  label: "Plugin Marketplace",icon:PuzzlePieceIcon  },
    { id: "keys",     label: "API Keys",         icon: KeyIcon          },
    { id: "openapi",  label: "OpenAPI Explorer", icon: CodeBracketIcon  },
    { id: "stream",   label: "Live Stream",      icon: SignalIcon       },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f9f8f6] p-6 lg:p-8">
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GlobeAltIcon className="w-5 h-5 text-[#800020]" />
              <span className="text-xs font-semibold text-[#800020] uppercase tracking-wider">Phase 5 · Headless Enterprise Infrastructure</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Enterprise API Console</h1>
            <p className="text-sm text-gray-500 mt-1">
              Route inference to any LLM. Register webhooks. Install connectors. Manage API keys.
              Every Kontra workflow is now a headless service — deployable inside any enterprise architecture, without vendor lock-in.
            </p>
          </div>
          {health && (
            <div className="flex items-center gap-2 px-4 py-2 bg-white border border-emerald-200 rounded-xl shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-semibold text-emerald-700">API v{health.version}</span>
            </div>
          )}
        </div>

        <div className="mt-5 p-4 bg-[#800020]/5 border border-[#800020]/15 rounded-xl flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-[#800020] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#800020]">Headless Architecture</p>
            <p className="text-xs text-gray-600 mt-0.5">
              All Kontra workflows are exposed as stateless REST endpoints at <code className="font-mono bg-white px-1 rounded">/api/v1</code>. Banks embed the API inside their own portals, CLOs pipe events to their data lakes, and servicers auto-trigger Jira/ServiceNow tickets — all without touching Kontra's UI. The event bus emits structured JSON for every state change; webhooks deliver it within milliseconds.
            </p>
          </div>
        </div>

        {/* Capability pills */}
        <div className="mt-4 flex flex-wrap gap-2">
          {["Agent-Agnostic APIs","External Model Routing","SSE Live Event Stream","HMAC-Signed Webhooks","10 Pre-Built Connectors","OpenAPI 3.1 Spec","API Key Management","Zero Vendor Lock-In"].map(c => (
            <span key={c} className="px-3 py-1 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-600 shadow-sm">{c}</span>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl border border-gray-200 p-1 w-fit flex-wrap">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === id ? "bg-[#800020] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {activeTab === "models"   && <ModelRouterPanel />}
        {activeTab === "webhooks" && <WebhookManager />}
        {activeTab === "plugins"  && <PluginMarketplace />}
        {activeTab === "keys"     && <ApiKeyManager />}
        {activeTab === "openapi"  && <OpenApiExplorer />}
        {activeTab === "stream"   && <LiveStream />}
      </div>
    </div>
  );
}
