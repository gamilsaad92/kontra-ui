import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AuthContext, clearKontraPersistedState } from "../../lib/authContext";
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

type OrgContextValue = {
  orgId: string | null;
  orgs: Organization[];
  isLoading: boolean;
  error: string | null;
  warning: string | null;
  setActiveOrg: (orgId: string | null) => void;
  retryInitialization: () => Promise<void>;
};

const OrgContext = createContext<OrgContextValue | null>(null);
const STARTUP_TIMEOUT_MS = 8_000;

const withTimeout = async <T,>(promise: Promise<T>, fallback: T, ms = STARTUP_TIMEOUT_MS): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

function normalizeOrgId(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function normalizeOrgs(res: BootstrapResponse | null | undefined): Organization[] {
  if (!res) return [];
 const items = res.orgs ?? res.organizations ?? res.items ?? [];
  return Array.isArray(items) ? items : [];
}

function pickActiveOrgId(res: BootstrapResponse, fallbackPersisted: string | null): string | null {
 const candidates = [res.active_org_id, res.activeOrgId, res.org_id, res.default_org_id, fallbackPersisted];
  for (const c of candidates) {
    const id = normalizeOrgId(c);
    if (id) return id;
  }
  return null;
}

function routeToLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext) as any;
  const [orgId, setOrgId] = useState<string | null>(() => normalizeOrgId(getOrgId()));
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const lastBootstrappedTokenRef = useRef<string | null>(null);

  const setActiveOrg = useCallback((nextOrgId: string | null) => {
    const normalized = normalizeOrgId(nextOrgId);
    setOrgId(normalized);
     persistOrgId(normalized);
    setOrgContext({ orgId: normalized ?? undefined, userId: auth?.user?.id });
  }, [auth?.user?.id]);

  const resetOrgState = useCallback(() => {
    setOrgs([]);
    setActiveOrg(null);
    setWarning(null);
    setError(null);
  }, [setActiveOrg]);
  
   const init = useCallback(async () => {
    const authLoading = Boolean(auth?.loading);
    const token: string | undefined = auth?.session?.access_token;
    const userId: string | undefined = auth?.user?.id;

  if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (!token) {
      lastBootstrappedTokenRef.current = null;
      resetOrgState();
      setIsLoading(false);
      return;
    }

   if (lastBootstrappedTokenRef.current === token) {
      setIsLoading(false);
      return;
    }

   setIsLoading(true);
    setError(null);
    setWarning(null);

    const persisted = normalizeOrgId(getOrgId());
    if (persisted) {
      setOrgContext({ orgId: persisted, userId });
    }

    try {
      const res = await withTimeout(
         apiRequest<BootstrapResponse>("POST", "/auth/bootstrap", {}, {}, { requireAuth: true }),
        null
      );

      const bootstrapOrgs = normalizeOrgs(res);
         const active = res ? pickActiveOrgId(res, persisted) : persisted;
      const resolvedActive = active ?? bootstrapOrgs[0]?.id ?? null;

      if (!resolvedActive || bootstrapOrgs.length === 0) {
        const orgError = new Error("Organization context missing after bootstrap") as Error & {
          status?: number;
          code?: string;
        };
        orgError.code = "ORG_REQUIRED";
        throw orgError;
      }

      setOrgs(bootstrapOrgs);
      setActiveOrg(resolvedActive);
      lastBootstrappedTokenRef.current = token;
      console.info("[bootstrap] workspace loaded", { orgId: resolvedActive });
    } catch (e: any) {
     const statusCode = typeof e?.status === "number" ? e.status : Number(e?.code);
      const errorCode = e?.code;
      const isUnauthorized = statusCode === 401 || errorCode === "AUTH_REQUIRED" || errorCode === "AUTH_INVALID";
      const isMissingOrg = errorCode === "ORG_REQUIRED";

      if (isUnauthorized || isMissingOrg) {
        clearKontraPersistedState();
        lastBootstrappedTokenRef.current = null;
        setOrgs([]);
        setActiveOrg(null);
        setWarning(null);
        setError(e?.message ?? "Authentication expired");
        routeToLogin();
      } else {
        setError(e?.message ?? "Organization bootstrap failed.");
        setWarning("Workspace data unavailable, retrying");
      }
      
      console.error("[bootstrap] organization load failed", e);
         } finally {
      setIsLoading(false);
    }
   }, [auth?.loading, auth?.session?.access_token, auth?.user?.id, resetOrgState, setActiveOrg]);

  useEffect(() => {
    void init();
  }, [init]);

  const retryInitialization = useCallback(async () => {
    lastBootstrappedTokenRef.current = null;
    await init();
  }, [init]);

  const value = useMemo<OrgContextValue>(
    () => ({
      orgId,
      orgs,
      isLoading,
      error,
      warning,
      setActiveOrg,
      retryInitialization,
    }),
    [orgId, orgs, isLoading, error, warning, setActiveOrg, retryInitialization]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
