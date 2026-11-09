export const STAGING_SUPABASE_URL = "https://jpemuoapbgzwapydqiio.supabase.co";
const STAGING_SUPABASE_HOST = new URL(STAGING_SUPABASE_URL).hostname;

function isConfiguredKey(value = "") {
  const normalized = String(value).trim();
  return Boolean(normalized)
    && !normalized.includes("<")
    && !normalized.includes(">")
    && !normalized.toUpperCase().includes("YOUR_")
    && !normalized.toLowerCase().includes("placeholder");
}

function isHttpUrl(value = "") {
  try {
    const parsed = new URL(String(value).trim());
    return (parsed.protocol === "https:" || parsed.protocol === "http:")
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
}

export function resolveSupabaseDeploymentContext({
  vercelEnv,
  gitRef,
  mode,
} = {}) {
  if (vercelEnv === "preview") return "preview";
  if (vercelEnv === "production") {
    return gitRef === "main" ? "production" : "staging";
  }
  if (vercelEnv === "development") return "development";
  if (vercelEnv) {
    throw new Error("Unrecognized Vercel deployment environment");
  }
  if (gitRef) return gitRef === "main" ? "production" : "preview";
  return mode === "development" ? "development" : "local";
}

export function resolveSupabaseConfig({
  url = "",
  anonKey = "",
  context = "local",
} = {}) {
  const configured = isHttpUrl(url) && isConfiguredKey(anonKey);
  if (context === "staging" || context === "preview") {
    let parsed;
    try {
      parsed = new URL(String(url).trim());
    } catch {
      throw new Error("Staging and preview builds require the approved staging Supabase project");
    }
    if (parsed.protocol !== "https:"
      || parsed.hostname !== STAGING_SUPABASE_HOST
      || parsed.origin !== STAGING_SUPABASE_URL
      || !configured) {
      throw new Error("Staging and preview builds require the approved staging Supabase project and anon key");
    }
  }

  return {
    url: configured ? String(url).trim() : "",
    anonKey: configured ? String(anonKey).trim() : "",
    configured,
  };
}
