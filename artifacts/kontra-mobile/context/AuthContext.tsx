import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "investor" | "borrower" | "servicer" | "lender_admin" | "platform_admin" | "asset_manager" | null;

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  portfolioValue?: number;
  loanCount?: number;
  accessToken?: string;
  refreshToken?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = "kontra_mobile_session";

/** Decode JWT payload without verifying signature */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Extract app_role from Supabase JWT custom claims */
function getRoleFromToken(token: string): UserRole {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const appMeta = payload.app_metadata as Record<string, string> | undefined;
  const userMeta = payload.user_metadata as Record<string, string> | undefined;
  const role = appMeta?.app_role ?? userMeta?.app_role ?? null;
  return (role as UserRole) ?? null;
}

/**
 * Get the Kontra API base URL.
 * In Expo, environment variables must be prefixed with EXPO_PUBLIC_.
 * Falls back to the deployed API on Render for production use.
 */
function getApiBase(): string {
  const url = (process.env.EXPO_PUBLIC_API_URL ?? "").trim();
  return url || "https://kontra-api.onrender.com";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Check token expiry if available
          if (parsed?.accessToken) {
            const payload = decodeJwtPayload(parsed.accessToken);
            const exp = (payload?.exp as number) ?? 0;
            if (!exp || exp * 1000 > Date.now()) {
              setUser(parsed);
            } else {
              // Token expired — clear session
              AsyncStorage.removeItem(SESSION_KEY);
            }
          }
        } catch {}
      }
      setIsLoading(false);
    });
  }, []);

  const login = async (email: string, password: string) => {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Sign in failed. Please check your credentials.");
    }

    const accessToken: string = json.access_token;
    const refreshToken: string = json.refresh_token ?? "";
    const role = getRoleFromToken(accessToken);

    // Extract name from the response — API may return user profile data
    const apiUser = json.user ?? {};
    const name: string =
      apiUser.user_metadata?.full_name ??
      apiUser.user_metadata?.name ??
      apiUser.email ??
      email;

    const u: User = {
      id: apiUser.id ?? "unknown",
      name,
      email: apiUser.email ?? email,
      role,
      accessToken,
      refreshToken,
    };

    setUser(u);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(u));
  };

  const logout = async () => {
    const token = user?.accessToken;
    setUser(null);
    await AsyncStorage.removeItem(SESSION_KEY);

    // Fire-and-forget: notify the backend to invalidate the session
    if (token) {
      const apiBase = getApiBase();
      fetch(`${apiBase}/api/auth/signout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {});
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
