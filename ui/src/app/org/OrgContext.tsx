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
   warning: string | null;
  setActiveOrg: (orgId: string | null) => void;
  retryInitialization: () => Promise<void>;
};

const OrgContext = createContext<OrgContextValue | null>(null);
const STARTUP_TIMEOUT_MS = 8_000;
const DEFAULT_PERSONAL_ORG: Organization = { id: "personal", name: "Personal Workspace" };

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

function normalizeOrgs(res: OrgsResponse | BootstrapResponse | null | undefined): Organization[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;

  const items =
    (res as any).orgs ??
    (res as any).organizations ??
    (res as any).items ??
    [];

  return Array.isArray(items) ? items : [];
}

function pickActiveOrgId(res: BootstrapResponse, fallbackPersisted: string | null): string | null {
  const candidates = [
    res.active_org_id,
    res.activeOrgId,
    res.org_id,
    res.default_org_id,
    fallbackPersisted,
  ];
  for (const c of candidates) {
    const id = normalizeOrgId(c);
    if (id) return id;
  }
  return null;
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext) as any;
  const [orgId, setOrgId] = useState<string | null>(() => normalizeOrgId(getOrgId()));
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const hasInitialized = useRef(false);
  
  const setActiveOrg = useCallback((nextOrgId: string | null) => {
    const normalized = normalizeOrgId(nextOrgId);
    setOrgId(normalized);
    persistOrgId(normalized); // per-domain persistence
    setOrgContext({ orgId: normalized ?? undefined, userId: auth?.user?.id }); // attach org context to api client headers, etc.
  }, [auth?.user?.id]);

  const init = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const initializing = Boolean(auth?.initializing);
    const token: string | undefined = auth?.session?.access_token;
    const userId: string | undefined = auth?.user?.id;

    if (initializing) {
      setIsLoading(true);
      return;
    }

    if (!token && !userId) {
      setOrgs([]);
      setActiveOrg(null);
      setWarning(null);
      setIsLoading(false);
      hasInitialized.current = false;
      return;
    }

   if (hasInitialized.current) {
      setIsLoading(false);
      return;
    }

    hasInitialized.current = true;

    const persisted = normalizeOrgId(getOrgId());
    if (persisted) {
       setOrgContext({ orgId: persisted, userId });
    }

    setIsLoading(false);
    
    try {
     const fallbackResponse: BootstrapResponse = {
        orgs: persisted ? [{ id: persisted, name: "Workspace" }] : [DEFAULT_PERSONAL_ORG],
        active_org_id: persisted ?? DEFAULT_PERSONAL_ORG.id,
      };

      const res = await withTimeout(
        apiRequest<BootstrapResponse>("POST", "/auth/bootstrap", {}, {}, { requireAuth: true }).catch(() => fallbackResponse),
        fallbackResponse
      );

      const bootstrapOrgs = normalizeOrgs(res);
      const safeOrgs = bootstrapOrgs.length > 0 ? bootstrapOrgs : [DEFAULT_PERSONAL_ORG];
      setOrgs(safeOrgs);
 
      const active = pickActiveOrgId(res, persisted) ?? safeOrgs[0]?.id ?? DEFAULT_PERSONAL_ORG.id;
      setActiveOrg(active);
      setWarning(bootstrapOrgs.length === 0 ? "Workspace data unavailable, retrying" : null);
      console.info("[bootstrap] workspace loaded", { orgId: active });
  
    } catch (e: any) {
      const msg = e?.message ?? "Organization bootstrap failed.";
      setOrgs([DEFAULT_PERSONAL_ORG]);
      setActiveOrg(DEFAULT_PERSONAL_ORG.id);
      setError(msg);
      setWarning("Workspace data unavailable, retrying");
      console.error("[bootstrap] organization load failed", e);
    }
  }, [auth?.initializing, auth?.session?.access_token, auth?.user?.id, setActiveOrg]);
  
  // Initialize and also re-run whenever auth state changes
  useEffect(() => {
    void init();
  }, [init]);

  const retryInitialization = useCallback(async () => {
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
