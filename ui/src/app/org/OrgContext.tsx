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
   activeOrgId?: string | number | null;
  org_id?: string | number | null;
   orgs?: Organization[];
  organizations?: Organization[];
  items?: Organization[];
};

type OrgsResponse =
  | Organization[]
  | {
      orgs?: Organization[];
      organizations?: Organization[];
        items?: Organization[];
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

const ORG_INIT_TIMEOUT_MS = 20_000;

function isTimeoutError(error: unknown) {
  return error instanceof Error && /timed out/i.test(error.message);
}

function delay(ms: number) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

async function fetchBootstrapWithRetry() {
  try {
    return await withTimeout(
      apiRequest<BootstrapResponse>("GET", "/api/me/bootstrap", undefined, {}, { requireAuth: true }),
      ORG_INIT_TIMEOUT_MS,
      "Organization bootstrap"
    );
  } catch (error) {
    if (!isTimeoutError(error)) {
      throw error;
    }

    console.warn("[OrgInit] Bootstrap request timed out. Retrying once...");
    await delay(500);

    return withTimeout(
      apiRequest<BootstrapResponse>("GET", "/api/me/bootstrap", undefined, {}, { requireAuth: true }),
      ORG_INIT_TIMEOUT_MS,
      "Organization bootstrap"
    );
  }
}

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
         : Array.isArray(response?.items)
          ? response.items
          : [];

  return rawOrgs
    .filter((org) => org && org.id != null)
    .map((org) => ({ ...org, id: String(org.id) }));
}

function ensureBootstrapShape(response: BootstrapResponse): BootstrapResponse {
  if (!response || typeof response !== "object") {
    throw new Error("Organization bootstrap returned an invalid response");
  }

  const hasOrgArray = Array.isArray(response.orgs) || Array.isArray(response.organizations) || Array.isArray(response.items);
  const hasOrgPointer = response.active_org_id != null || response.activeOrgId != null || response.default_org_id != null || response.org_id != null;

  if (!hasOrgArray && !hasOrgPointer) {
    throw new Error("Organization bootstrap response is missing required organization fields");
  }

  return response;
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
      const bootstrapRaw = await fetchBootstrapWithRetry();
      const nextOrgs = await withTimeout(refreshOrgs(), ORG_INIT_TIMEOUT_MS, "Organization list fetch").catch((orgError) => {
        const message = orgError instanceof Error ? orgError.message : "Unknown organization list error";
        console.warn("[OrgInit] Proceeding without org list from /api/orgs", message);
        return [] as Organization[];
      });

      const bootstrap = ensureBootstrapShape(bootstrapRaw);
      const bootstrapOrgs = normalizeOrgs(bootstrap);
      const mergedOrgs = nextOrgs.length > 0 ? nextOrgs : bootstrapOrgs;
      if (nextOrgs.length === 0 && bootstrapOrgs.length > 0) {
        setOrgs(bootstrapOrgs);
      }

      const activeOrgCandidate = bootstrap?.active_org_id ?? bootstrap?.activeOrgId ?? bootstrap?.default_org_id ?? bootstrap?.org_id;
      const activeOrgId = activeOrgCandidate == null ? null : String(activeOrgCandidate);
      const lastSelectedOrgId = getOrgId();
       const firstOrgId = mergedOrgs[0]?.id ? String(mergedOrgs[0].id) : null;
      const resolvedOrgId = activeOrgId || lastSelectedOrgId || firstOrgId;

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
