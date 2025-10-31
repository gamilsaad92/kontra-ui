const configured = import.meta.env.VITE_API_URL?.trim();

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
const normalized = (configured && configured.length ? configured : fallback).replace(/\/+$/, "");

export const API_BASE = normalized;

