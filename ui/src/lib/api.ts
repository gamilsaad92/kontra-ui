import axios from "axios";
import { supabase } from "./supabaseClient.js";

const base = import.meta.env.VITE_API_URL ?? "";
const baseURL = base.endsWith("/api") ? base : `${base}/api`;
export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  let token: string | null = null;
  try {
    token =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("sessionToken")
        : null;
  } catch {
    token = null;
  }

  if (!token && supabase?.auth) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token ?? null;
    } catch {
      token = null;
    }
  }

  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)[
      "Authorization"
    ] = `Bearer ${token}`;
  }
  return config;
});
export function withOrg(orgId?: number) {
  return { headers: { "X-Org-Id": String(orgId ?? 1) } };
}
