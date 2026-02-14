import { useEffect, useState } from "react";
import { api } from "../../lib/apiClient";

type SsoConfigResponse = {
  providers: Array<{ name: string; enabled: boolean }>;
  role?: string;
  organization?: { id: string; name: string } | null;
  savedConfig?: Record<string, unknown> | null;
};

export default function SsoSettingsPage() {
  const [data, setData] = useState<SsoConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domain, setDomain] = useState("");
  const [provider, setProvider] = useState("oidc");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<SsoConfigResponse>("/sso/config");
      setData(response.data);
      const existingDomain = typeof response.data?.savedConfig?.domain === "string" ? response.data.savedConfig.domain : "";
      setDomain(existingDomain);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load SSO settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post("/sso/config", { provider, domain });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="rounded border bg-white p-4">Loading SSO configuration…</div>;
  if (error) return <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>;

  return (
    <div className="space-y-4 rounded border bg-white p-4">
      <h1 className="text-xl font-semibold">SSO Settings</h1>
      <p className="text-sm text-slate-600">Configure organization SSO settings with real backend persistence.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">Provider
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="mt-1 w-full rounded border p-2">
            {(data?.providers ?? []).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Domain
          <input value={domain} onChange={(e) => setDomain(e.target.value)} className="mt-1 w-full rounded border p-2" placeholder="company.com" />
        </label>
      </div>
      <button onClick={save} disabled={saving || !domain} className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50">
        {saving ? "Saving…" : "Save SSO Config"}
      </button>
      {!data?.savedConfig && <p className="text-sm text-slate-500">No SSO config yet. Save one to enable SSO for your org.</p>}
    </div>
  );
}
