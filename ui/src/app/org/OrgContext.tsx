import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "../../lib/authContext";
import { apiRequest, setOrgContext } from "../../lib/apiClient";
import { getOrgId, setOrgId as persistOrgId } from "../../lib/orgContext";

type Organization = {
  id: string;
  name: string;
  role?: string;
};

type BootstrapResponse = {
  user: { id: string; email?: string };
  default_org_id: string | number | null;
};

type OrgsResponse =
  | Organization[]
  | {
      orgs?: Organization[];
      organizations?: Organization[];
    };

type OrgContextValue = {
  orgId: string | null;
  orgs: Organization[];
  isLoading: boolean;
  setOrgId: (orgId: string | null) => void;
  refreshOrgs: () => Promise<Organization[]>;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { session, isLoading: isAuthLoading } = useContext(AuthContext);
    const location = useLocation();
  const navigate = useNavigate();
  const [orgId, setOrgIdState] = useState<string | null>(() => getOrgId());
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const setOrgId = useCallback((nextOrgId: string | null) => {
    setOrgIdState(nextOrgId);
    persistOrgId(nextOrgId);
  }, []);

  const refreshOrgs = useCallback(async (): Promise<Organization[]> => {
    if (!session?.access_token) {
      setOrgs([]);
      return [];
    }

      const response = await apiRequest<OrgsResponse>("GET", "/api/orgs", undefined, {}, { requireAuth: true });
    const rawOrgs = Array.isArray(response)
      ? response
      : Array.isArray(response?.orgs)
        ? response.orgs
        : Array.isArray(response?.organizations)
          ? response.organizations
          : [];
    const nextOrgs = rawOrgs.map((org) => ({ ...org, id: String(org.id) }));
    setOrgs(nextOrgs);
    return nextOrgs;
  }, [session?.access_token]);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!session?.access_token) {
      setOrgs([]);
      setOrgId(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    apiRequest<BootstrapResponse>("GET", "/api/me/bootstrap", undefined, {}, { requireAuth: true })
      .then(async (bootstrap) => {
        if (!isMounted) return;
        const defaultOrgId = bootstrap?.default_org_id == null ? null : String(bootstrap.default_org_id);
        setOrgId(defaultOrgId);
        if (!defaultOrgId && location.pathname !== "/organizations") {
          navigate("/organizations", { replace: true });
        }
        await refreshOrgs();
      })
      .catch(async () => {
        if (!isMounted) return;
     await refreshOrgs();
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, location.pathname, navigate, refreshOrgs, session?.access_token, setOrgId]);

  useEffect(() => {
    setOrgContext({
      orgId: orgId ?? undefined,
      userId: session?.user?.id ?? undefined,
    });
  }, [orgId, session?.access_token, session?.user?.id]);

  const value = useMemo<OrgContextValue>(
    () => ({ orgId, orgs, isLoading, setOrgId, refreshOrgs }),
    [isLoading, orgId, orgs, refreshOrgs, setOrgId]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error("useOrg must be used within OrgProvider");
  }
  return context;
}
