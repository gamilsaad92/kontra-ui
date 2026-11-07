export function resolveApiBase(env = {}, fallbackOrigin = "") {
  if (env.VITE_API_ROUTING_MODE === "same-origin") return "";

  const configured = [
    env.VITE_API_BASE,
    env.VITE_API_BASE_URL,
    env.VITE_API_URL,
  ].find((value) => typeof value === "string" && value.trim());

  const fallback = String(fallbackOrigin || "").trim();
  const isLocal = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(fallback);
  const base = configured?.trim() || (isLocal ? fallback : "");

  return base.replace(/\/+$/, "").replace(/\/api$/, "");
}
