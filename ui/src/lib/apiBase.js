const configured =
  "https://kontra-api-launch-validation.onrender.com" ||
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  import.meta.env.VITE_API_URL?.trim() ||
  "";
function resolveFallbackBase() {
  const origin =
    (typeof globalThis !== "undefined" &&
      globalThis.location &&
      typeof globalThis.location.origin === "string"
      ? globalThis.location.origin
      : "") || "";

  return origin.trim();
}

const fallback = resolveFallbackBase();
const isLocalOrigin = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(fallback);
// Production previews must not silently target the Vercel origin. If a Vercel
// project ignores its checked-in env block, same-origin /api requests can hit
// the wrong project root and surface as a generic "Load failed" room error.
const fallbackBase = isLocalOrigin ? fallback : "https://kontra-api.onrender.com";
const normalized = (configured && configured.length ? configured : fallbackBase)
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

export const API_BASE = normalized;
