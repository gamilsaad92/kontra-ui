import { resolveApiRequestCredentials } from "./apiRequestCredentials.mjs";
import { resolveApiBase } from "./apiBaseRouting.mjs";

const env = import.meta.env || {};
const fallbackOrigin =
  typeof globalThis !== "undefined" &&
  typeof globalThis.location?.origin === "string"
    ? globalThis.location.origin
    : "";
export const API_BASE = resolveApiBase(env, fallbackOrigin);

if (typeof window !== 'undefined' && typeof window.fetch === 'function' && !window.__kontraApiCredentialsFetch) {
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
