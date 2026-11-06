import { resolveApiRequestCredentials } from "./apiRequestCredentials.mjs";

const configured =
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
// Hosted builds must configure their API explicitly. Same-origin /api requests
// remain available for deployments that provide a checked-in rewrite, while
// avoiding a production API origin being embedded in staging bundles.
const fallbackBase = isLocalOrigin ? fallback : "";
const normalized = (configured && configured.length ? configured : fallbackBase)
  .replace(/\/+$/, "")
  .replace(/\/api$/, "");

export const API_BASE = normalized;

if (typeof window !== 'undefined' && !window.__kontraApiCredentialsFetch) {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const requestUrl = typeof input === 'string' ? input : input?.url;
    const credentials = resolveApiRequestCredentials(
      requestUrl,
      API_BASE,
      window.location.href,
    );
    return nativeFetch(input, credentials ? { ...init, credentials: init.credentials || credentials } : init);
  };
  window.__kontraApiCredentialsFetch = true;
}
