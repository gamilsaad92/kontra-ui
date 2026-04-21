import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { setOrgContext } from "./apiClient";

export interface Org {
  id: string;
  name: string;
  role: string;
  status?: string;
  createdAt?: string;
}

export interface OrgContextValue {
  orgs: Org[];
  activeOrg: Org | null;
  loading: boolean;
  setActiveOrg: (org: Org) => void;
  refreshOrgs: () => Promise<void>;
}

export const OrgContext = createContext<OrgContextValue>({
  orgs: [],
  activeOrg: null,
  loading: true,
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
    .filter((o) => o && typeof o === "object" && o.id)
    .map((o) => ({
      id: String(o.id),
      name: String(o.name || "Organization"),
      role: String(o.role || o.membership_role || "member"),
      status: String(o.status || "active"),
      createdAt: o.created_at || o.createdAt || undefined,
    }));
}

interface OrgProviderProps {
  children: React.ReactNode;
  accessToken?: string | null;
  userId?: string | null;
  apiBase?: string;
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
  const bootstrappedRef = useRef(false);

  const applyActiveOrg = useCallback(
    (org: Org, allOrgs: Org[]) => {
      // Validate the org is actually in the user's membership list — never trust localStorage alone
      const validated = allOrgs.find((o) => o.id === org.id) || allOrgs[0] || null;
      if (!validated) return;
      setActiveOrgState(validated);
      writeStoredOrgId(validated.id);
      // Sync into the global API client so X-Org-Id header is sent
      setOrgContext({ orgId: validated.id, userId: userId ?? undefined });
    },
    [userId]
  );

  const refreshOrgs = useCallback(async () => {
    if (!accessToken) {
      setOrgs([]);
      setActiveOrgState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const base = apiBase.replace(/\/+$/, "");
      const res = await fetch(`${base}/api/me/bootstrap`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        console.warn("[OrgProvider] bootstrap returned", res.status);
        setLoading(false);
        return;
      }
      const data = await res.json();

      const normalized = normalizeOrgs(data?.orgs);
      setOrgs(normalized);

      if (normalized.length === 0) {
        setLoading(false);
        return;
      }

      // Resolve active org: prefer stored → server's activeOrgId → first in list
      const storedId = readStoredOrgId();
      const serverActiveId = data?.activeOrgId || data?.active_org_id || null;
      const resolvedId = storedId || serverActiveId || normalized[0].id;

      const resolved =
        normalized.find((o) => o.id === resolvedId) || normalized[0];
      applyActiveOrg(resolved, normalized);
    } catch (err) {
      console.warn("[OrgProvider] org bootstrap failed", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBase, applyActiveOrg]);

  // Bootstrap once when the access token changes (login/logout)
  useEffect(() => {
    bootstrappedRef.current = false;
  }, [accessToken]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    // Optimistically apply any stored org ID immediately so API calls that
    // fire before bootstrap completes still get the X-Org-Id header.
    if (accessToken) {
      const stored = readStoredOrgId();
      if (stored) {
        setOrgContext({ orgId: stored, userId: userId ?? undefined });
      }
    }
    refreshOrgs();
  }, [refreshOrgs, accessToken, userId]);

  // Clear everything on logout
  useEffect(() => {
    if (!accessToken) {
      setOrgs([]);
      setActiveOrgState(null);
      setOrgContext({});
      writeStoredOrgId(null);
    }
  }, [accessToken]);

  const setActiveOrg = useCallback(
    (org: Org) => {
      applyActiveOrg(org, orgs);
    },
    [applyActiveOrg, orgs]
  );

  const value = useMemo<OrgContextValue>(
    () => ({ orgs, activeOrg, loading, setActiveOrg, refreshOrgs }),
    [orgs, activeOrg, loading, setActiveOrg, refreshOrgs]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

