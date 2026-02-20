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
  user?: { id: string; email?: string };
  default_org_id?: string | number | null;
  active_org_id?: string | number | null;
  org_id?: string | number | null;
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
    error: string | null;
  setOrgId: (orgId: string | null) => void;
  refreshOrgs: () => Promise<Organization[]>;
   retryInitialization: () => Promise<void>;
};

const OrgContext = createContext<OrgContextValue | null>(null);

const ORG_INIT_TIMEOUT_MS = 12_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000} seconds`)), ms) as unknown as number;
  });

  try {
    return (await Promise.race([promise, timeout])) as T;
  } finally {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

function normalizeOrgs(response: OrgsResponse): Organization[] {
  const rawOrgs = Array.isArray(response)
    ? response
    : Array.isArray(response?.orgs)
      ? response.orgs
      : Array.isArray(response?.organizations)
        ? response.organizations
        : [];

  return rawOrgs.map((org) => ({ ...org, id: String(org.id) }));
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const { session, isLoading: isAuthLoading } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [orgId, setOrgIdState] = useState<string | null>(() => getOrgId());
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
  
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
    const nextOrgs = normalizeOrgs(response);
    setOrgs(nextOrgs);
    return nextOrgs;
  }, [session?.access_token]);

   const initializeOrgContext = useCallback(async () => {
    if (!session?.access_token) {
      setOrgs([]);
      setOrgId(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    console.info("[OrgInit] Starting organization initialization");

    try {
      const [bootstrap, nextOrgs] = await Promise.all([
        withTimeout(
          apiRequest<BootstrapResponse>("GET", "/api/me/bootstrap", undefined, {}, { requireAuth: true }),
          ORG_INIT_TIMEOUT_MS,
          "Organization bootstrap"
        ),
        withTimeout(refreshOrgs(), ORG_INIT_TIMEOUT_MS, "Organization list fetch"),
      ]);

      const activeOrgCandidate = bootstrap?.active_org_id ?? bootstrap?.default_org_id ?? bootstrap?.org_id;
      const activeOrgId = activeOrgCandidate == null ? null : String(activeOrgCandidate);
      const lastSelectedOrgId = getOrgId();
      const firstOrgId = nextOrgs[0]?.id ? String(nextOrgs[0].id) : null;
      const resolvedOrgId = activeOrgId || lastSelectedOrgId || firstOrgId;

      console.info("[OrgInit] Resolved organization", {
        resolvedOrgId: resolvedOrgId ?? "none",
        source: activeOrgId ? "active" : lastSelectedOrgId ? "localStorage" : firstOrgId ? "org-list" : "none",
      });

      if (resolvedOrgId) {
        setOrgId(resolvedOrgId);
      } else {
        setOrgId(null);
        if (location.pathname !== "/organizations") {
          const nextPath = `${location.pathname}${location.search}${location.hash}` || "/dashboard";
          navigate(`/organizations?next=${encodeURIComponent(nextPath)}`, { replace: true });
        }
      }

      console.info("[OrgInit] Organization initialization succeeded");
    } catch (initError) {
      const message = initError instanceof Error ? initError.message : "Unable to initialize organization context";
      console.error("[OrgInit] Organization initialization failed", message);
      setOrgId(null);
      setError(`Unable to load organization context. ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [location.hash, location.pathname, location.search, navigate, refreshOrgs, session?.access_token, setOrgId]);

  useEffect(() => {
    if (isAuthLoading) return;
    void initializeOrgContext();
  }, [initializeOrgContext, isAuthLoading]);

  useEffect(() => {
    setOrgContext({
      orgId: orgId ?? undefined,
      userId: session?.user?.id ?? undefined,
    });
  }, [orgId, session?.access_token, session?.user?.id]);

  const value = useMemo<OrgContextValue>(
    () => ({ orgId, orgs, isLoading, error, setOrgId, refreshOrgs, retryInitialization: initializeOrgContext }),
    [error, initializeOrgContext, isLoading, orgId, orgs, refreshOrgs, setOrgId]
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
