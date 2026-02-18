import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../../lib/apiClient";
import { useOrg } from "./OrgContext";

type CreateOrgResponse = {
  org?: {
    id: string;
    name: string;
  };
};

export default function OrganizationsPage() {
  const { orgId, orgs, isLoading, setOrgId, refreshOrgs } = useOrg();
  const navigate = useNavigate();
  const location = useLocation();
 const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  
  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("next") || "/dashboard";
  }, [location.search]);

  useEffect(() => {
    if (!isLoading && orgId) {
      navigate(nextPath, { replace: true });
    }
  }, [isLoading, navigate, nextPath, orgId]);

  const handleSelect = async (nextOrgId: string) => {
    const normalizedOrgId = String(nextOrgId);
    setOrgId(normalizedOrgId);
    try {
    await apiRequest("POST", "/api/orgs/select", { org_id: normalizedOrgId }, {}, { requireAuth: true });
    } catch {
      // Selection persistence is best-effort.
    }
    navigate(nextPath, { replace: true });
  };

   const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      const created = await apiRequest<CreateOrgResponse>("POST", "/api/orgs", { name: trimmedName }, {}, { requireAuth: true });
      const nextOrgId = created?.org?.id ? String(created.org.id) : null;

      await refreshOrgs();

      if (nextOrgId) {
      setOrgId(nextOrgId);
        navigate("/dashboard", { replace: true });
        return;
      }

      setCreateError("Organization was created, but selecting it failed. Please choose it from the list.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create organization";
      setCreateError(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-2xl space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Select an organization to continue</h1>
        <p className="text-sm text-slate-300">Choose the workspace you want to open, or create a new one.</p>
        </div>

        <button
          type="button"
          onClick={() => refreshOrgs()}
          className="rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
        >
          Refresh organizations
        </button>

        {isLoading ? (
          <p className="text-sm text-slate-300">Loading organizations…</p>
        ) : orgs.length === 0 ? (
          <p className="text-sm text-amber-200">No organizations are available yet. Create one to continue.</p>
        ) : (
          <ul className="space-y-3">
            {orgs.map((org) => (
              <li key={org.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(org.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-700 px-4 py-3 text-left hover:bg-slate-800"
                >
                  <span className="font-medium">{org.name}</span>
                  {org.role ? <span className="text-xs text-slate-400">{org.role}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
        
        <form onSubmit={handleCreate} className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <label className="block text-sm font-medium text-slate-200" htmlFor="org-name">
            Organization name
          </label>
          <input
            id="org-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none ring-blue-500 focus:ring"
            placeholder="My Kontra Workspace"
            maxLength={120}
            required
          />
          <button
            type="submit"
            disabled={isCreating}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isCreating ? "Creating…" : "Create organization"}
          </button>
          {createError ? <p className="text-sm text-rose-300">{createError}</p> : null}
        </form>
      </div>
    </div>
  );
}
