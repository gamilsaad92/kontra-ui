import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { setOrgContext } from "./apiClient";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

export interface Org {
  id: string;
  name: string;
  role: string;
  status?: string;
  createdAt?: string;
}

interface OrgContextValue {
  orgs: Org[];
  activeOrganizationId: string | null;
  activeOrg: Org | null;
  loading: boolean;
   authReady: boolean;
  error: string | null;
  setActiveOrg: (org: Org) => void;
  refreshOrgs: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue>({
  orgs: [],
  activeOrg: null,
    activeOrganizationId: null,
  loading: true,
   authReady: false,
  error: null,
  setActiveOrg: () => undefined,
  refreshOrgs: async () => undefined,
});

const STORAGE_KEY = "kontra_active_org_id";

function readStoredOrgId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredOrgId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function normalizeOrgs(raw: unknown): Org[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o) => o && typeof o === "object" && (o as Record<string, unknown>).id)
    .map((o) => ({
        id: String((o as Record<string, unknown>).id),
      name: String((o as Record<string, unknown>).name || "Organization"),
      role: String((o as Record<string, unknown>).role || (o as Record<string, unknown>).membership_role || "member"),
      status: String((o as Record<string, unknown>).status || "active"),
      createdAt: ((o as Record<string, unknown>).created_at || (o as Record<string, unknown>).createdAt || undefined) as string | undefined,
    }));
}

interface OrgProviderProps {
  children: React.ReactNode;
  accessToken?: string | null;
  userId?: string | null;
  apiBase?: string;
}

async function resolveVerifiedSupabaseUserId(accessToken?: string | null): Promise<string | null> {
  if (!accessToken || !isSupabaseConfigured || !supabase?.auth) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error) {
      console.warn("[OrgProvider] verified user lookup failed", error.message);
      return null;
    }
    return data.user?.id ? String(data.user.id) : null;
  } catch (error) {
    console.warn("[OrgProvider] verified user lookup threw", error);
    return null;
  }
}

export function OrgProvider({
  children,
  accessToken,
  userId,
  apiBase = "",
}: OrgProviderProps) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrg, setActiveOrgState] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
   const [authReady, setAuthReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bootstrappedRef = useRef(false);

  const applyActiveOrg = useCallback(
    (org: Org, allOrgs: Org[]) => {
    const validated = allOrgs.find((candidate) => candidate.id === org.id) || allOrgs[0] || null;
      if (!validated) return;
      setActiveOrgState(validated);
      writeStoredOrgId(validated.id);
      setOrgContext({ orgId: validated.id, userId: userId ?? undefined });
    },
    [userId]
  );

   const clearOrgState = useCallback(() => {
    setOrgs([]);
    setActiveOrgState(null);
    writeStoredOrgId(null);
    setOrgContext({ userId: userId ?? undefined });
  }, [userId]);

  const refreshOrgs = useCallback(async () => {
    if (!accessToken) {
      clearOrgState();
      setError(null);
      setLoading(false);
      setAuthReady(true);
      return;
    }

    setLoading(true);
        setAuthReady(false);
    setError(null);

    try {
      const verifiedUserId = await resolveVerifiedSupabaseUserId(accessToken);
      const base = apiBase.replace(/\/+$/, "");
      const res = await fetch(`${base}/api/me/bootstrap`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
         const message = payload?.message || payload?.error || `Organization bootstrap failed (${res.status})`;
        throw new Error(message);
      }

    const normalized = normalizeOrgs(payload?.orgs);
      setOrgs(normalized);

      if (normalized.length === 0) {
       clearOrgState();
        setError("No organization membership was found for this account.");
        return;
      }

      const storedId = readStoredOrgId();
      const serverActiveId = payload?.activeOrgId || payload?.active_org_id || null;
      const resolvedId = storedId || serverActiveId || normalized[0].id;
      const resolved = normalized.find((org) => org.id === resolvedId) || normalized[0];

      applyActiveOrg(resolved, normalized);
          if (verifiedUserId && userId && verifiedUserId !== userId) {
        console.warn("[OrgProvider] session user id differed from verified user id", { userId, verifiedUserId });
      }
    } catch (err) {
      console.warn("[OrgProvider] org bootstrap failed", err);
          clearOrgState();
      setError(err instanceof Error ? err.message : "Failed to initialize organization context.");
    } finally {
      setLoading(false);
      setAuthReady(true);
    }
  }, [accessToken, apiBase, applyActiveOrg, clearOrgState, userId]);

  useEffect(() => {
    bootstrappedRef.current = false;
  }, [accessToken]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    refreshOrgs();
  }, [refreshOrgs]);

  useEffect(() => {
    if (!accessToken) {
        clearOrgState();
      setError(null);
      setLoading(false);
      setAuthReady(true);
    }
  }, [accessToken, clearOrgState]);

  const setActiveOrg = useCallback(
    (org: Org) => {
      applyActiveOrg(org, orgs);
    },
    [applyActiveOrg, orgs]
  );

  const value = useMemo<OrgContextValue>(
   () => ({
      orgs,
      activeOrg,
      activeOrganizationId: activeOrg?.id ?? null,
      loading,
      authReady,
      error,
      setActiveOrg,
      refreshOrgs,
    }),
    [orgs, activeOrg, loading, authReady, error, setActiveOrg, refreshOrgs]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  return useContext(OrgContext);
}
