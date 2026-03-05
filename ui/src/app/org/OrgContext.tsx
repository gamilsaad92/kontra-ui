import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
  setActiveOrg: (orgId: string | null) => void;
  retryInitialization: () => Promise<void>;
};

const OrgContext = createContext<OrgContextValue | null>(null);

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
  const navigate = useNavigate();
  const location = useLocation();

  const [orgId, setOrgId] = useState<string | null>(() => normalizeOrgId(getOrgId()));
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const setActiveOrg = useCallback((nextOrgId: string | null) => {
    const normalized = normalizeOrgId(nextOrgId);
    setOrgId(normalized);
    persistOrgId(normalized); // per-domain persistence
    setOrgContext(normalized); // attach org context to api client headers, etc.
  }, []);

  const init = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // ---- AUTH GATE (CRITICAL) ----
    // We only bootstrap orgs if Auth is READY and we have a token/user.
    const initializing = Boolean(auth?.initializing);
    const token: string | undefined = auth?.session?.access_token;
    const userId: string | undefined = auth?.user?.id;

    // If auth is still initializing, wait (but don’t spin forever elsewhere)
    if (initializing) {
      setIsLoading(true);
      return;
    }

    // If not authenticated (new domain, after closing browser, etc.), stop immediately.
    if (!token && !userId) {
      setOrgs([]);
      setActiveOrg(null);
      setIsLoading(false);
      return;
    }

    // Optional: set org context from persisted id early (doesn't assume it's valid)
    const persisted = normalizeOrgId(getOrgId());
    if (persisted) {
      setOrgContext(persisted);
    }

    // ---- BOOTSTRAP WITH HARD TIMEOUT ----
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    try {
      // This endpoint should return org list + active/default org id.
      // Adjust URL if yours differs.
      const res = (await apiRequest("/auth/bootstrap", {
        method: "POST",
        signal: controller.signal,
      })) as BootstrapResponse;

      const bootstrapOrgs = normalizeOrgs(res);
      setOrgs(bootstrapOrgs);

      const active = pickActiveOrgId(res, persisted);

      if (active) {
        setActiveOrg(active);
        setIsLoading(false);
        return;
      }

      // If bootstrap didn’t give an active org but did return orgs, pick first.
      if (bootstrapOrgs.length > 0) {
        setActiveOrg(bootstrapOrgs[0].id);
        setIsLoading(false);
        return;
      }

      // No orgs returned => user must create/select org
      setActiveOrg(null);
      setIsLoading(false);

      // IMPORTANT: redirect off protected routes if needed
      if (!location.pathname.startsWith("/organizations")) {
        navigate("/organizations", { replace: true, state: { from: location.pathname } });
      }
    } catch (e: any) {
      const msg =
        e?.name === "AbortError"
          ? "Organization bootstrap timed out. Please retry."
          : (e?.message ?? "Organization bootstrap failed.");

      setOrgs([]);
      setActiveOrg(null);
      setError(msg);
      setIsLoading(false);
    } finally {
      clearTimeout(timer);
    }
  }, [auth, location.pathname, navigate, setActiveOrg]);

  // Initialize and also re-run whenever auth state changes
  useEffect(() => {
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.initializing, auth?.session?.access_token, auth?.user?.id]);

  const retryInitialization = useCallback(async () => {
    await init();
  }, [init]);

  const value = useMemo<OrgContextValue>(
    () => ({
      orgId,
      orgs,
      isLoading,
      error,
      setActiveOrg,
      retryInitialization,
    }),
    [orgId, orgs, isLoading, error, setActiveOrg, retryInitialization]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
