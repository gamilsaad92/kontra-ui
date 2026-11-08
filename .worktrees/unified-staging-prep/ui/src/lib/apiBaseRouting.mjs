export function resolveApiBase(env = {}, fallbackOrigin = "") {
  const isDevelopment = env.DEV === true || env.MODE === "development";
  const mode = env.VITE_API_ROUTING_MODE || (isDevelopment ? "same-origin" : "");

  if (mode === "same-origin") return "";
  if (mode !== "direct") {
    throw new Error("VITE_API_ROUTING_MODE must be same-origin or development-only direct");
  }
  if (!isDevelopment) {
    throw new Error("Direct API routing is permitted only in local development");
  }

  const configured = [
    env.VITE_API_BASE,
    env.VITE_API_BASE_URL,
    env.VITE_API_URL,
    fallbackOrigin,
  ].find((value) => typeof value === "string" && value.trim());
  if (!configured) return "";

  let url;
  try {
    url = new URL(configured.trim());
  } catch {
    throw new Error("Direct API routing requires a valid local or staging URL");
  }
  const allowedHosts = new Set(["localhost", "127.0.0.1", "api-staging.kontraplatform.com"]);
  if (!allowedHosts.has(url.hostname)) {
    throw new Error("Direct API routing cannot target production or an unknown host");
  }

  return `${url.origin}`.replace(/\/api$/, "");
}
