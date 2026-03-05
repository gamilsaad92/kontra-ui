// src/lib/http.js
export async function fetchJsonWithRetry(url, options = {}, cfg = {}) {
  const {
    timeoutMs = 45000,
    retries = 4,
    retryBaseDelayMs = 600,
    retryMaxDelayMs = 4000,
    retryOnStatuses = [408, 425, 429, 500, 502, 503, 504],
  } = cfg;

  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });

      // Retry on transient server statuses
      if (!res.ok && retryOnStatuses.includes(res.status) && attempt < retries) {
        const delay = Math.min(
          retryMaxDelayMs,
          retryBaseDelayMs * Math.pow(2, attempt)
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Parse JSON if possible (even on errors) for better debugging
      const text = await res.text();
      const data = text ? safeJson(text) : null;

      if (!res.ok) {
        const msg = data?.error || data?.message || text || `HTTP ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        err.body = data;
        throw err;
      }

      return data;
    } catch (e) {
      lastErr = e;

      // Retry on abort/network errors
      const isAbort = e?.name === "AbortError";
      const isNetwork = e instanceof TypeError; // fetch failed
      if ((isAbort || isNetwork) && attempt < retries) {
        const delay = Math.min(
          retryMaxDelayMs,
          retryBaseDelayMs * Math.pow(2, attempt)
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  throw lastErr;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
