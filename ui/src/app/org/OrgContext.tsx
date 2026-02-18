import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
  orgs: Organization[];
  default_org_id: string | null;
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

    const bootstrap = await apiRequest<BootstrapResponse>("GET", "/api/me/bootstrap", undefined, {}, { requireAuth: true });
    const nextOrgs = Array.isArray(bootstrap?.orgs) ? bootstrap.orgs : [];
    setOrgs(nextOrgs);

      const hasCurrentOrgAccess = Boolean(orgId && nextOrgs.some((org) => org.id === orgId));
    if (hasCurrentOrgAccess) {
      return nextOrgs;
    }

       const bootstrapDefault = bootstrap.default_org_id;
    const selected = bootstrapDefault && nextOrgs.some((org) => org.id === bootstrapDefault)
      ? bootstrapDefault
      : nextOrgs[0]?.id || null;

    setOrgId(selected);
    return nextOrgs;
  }, [orgId, session?.access_token, setOrgId]);

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
    refreshOrgs()
      .catch(() => {
        if (!isMounted) return;
        setOrgs([]);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAuthLoading, refreshOrgs, session?.access_token, setOrgId]);

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
