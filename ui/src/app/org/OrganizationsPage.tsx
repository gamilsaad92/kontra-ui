import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../../lib/apiClient";
import { useOrg } from "./OrgContext";

export default function OrganizationsPage() {
  const { orgId, orgs, isLoading, setOrgId, refreshOrgs } = useOrg();
  const navigate = useNavigate();
  const location = useLocation();

  const nextPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("next") || "/dashboard";
  }, [location.search]);

  useEffect(() => {
    if (!isLoading && orgId) {
      navigate(nextPath, { replace: true });
    }
  }, [isLoading, navigate, nextPath, orgId]);

  const handleSelect = async (orgId: string) => {
    setOrgId(orgId);
    try {
      await apiRequest("POST", "/api/orgs/select", { org_id: orgId }, {}, { requireAuth: true });
    } catch {
      // Selection persistence is best-effort.
    }
    navigate(nextPath, { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="w-full max-w-2xl space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Select an organization to continue</h1>
          <p className="text-sm text-slate-300">Choose the workspace you want to open.</p>
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
          <p className="text-sm text-amber-200">No organizations are available for this account.</p>
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
      </div>
    </div>
  );
}
