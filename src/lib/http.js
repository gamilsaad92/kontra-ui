// src/lib/http.js
export async function fetchJsonWithRetry(url, options = {}, cfg = {}) {
  const {
    timeoutMs = 45000,
    retries = 5,
    retryBaseDelayMs = 700,
    retryMaxDelayMs = 5000,
    retryOnStatuses = [408, 425, 429, 500, 502, 503, 504],
  } = cfg;

  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...(options.headers || {}),
        },
      });

      if (!res.ok && retryOnStatuses.includes(res.status) && attempt < retries) {
        const delay = Math.min(retryMaxDelayMs, retryBaseDelayMs * Math.pow(2, attempt));
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

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
      const isAbort = e?.name === "AbortError";
      const isNetwork = e instanceof TypeError; // fetch failed

      if ((isAbort || isNetwork) && attempt < retries) {
        const delay = Math.min(retryMaxDelayMs, retryBaseDelayMs * Math.pow(2, attempt));
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw e;
    } finally {
      clearTimeout(timer);
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
