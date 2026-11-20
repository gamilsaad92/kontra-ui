export function resolveApiRequestCredentials(requestUrl, apiBase, pageUrl) {
  try {
    const page = new URL(pageUrl);
    const apiOrigin = apiBase ? new URL(apiBase, page).origin : page.origin;
    const requestOrigin = new URL(requestUrl, page).origin;
    return requestOrigin === apiOrigin ? 'include' : undefined;
  } catch {
    return undefined;
  }
}

export function stripLegacyOwnerCredentials(init = {}) {
  const headers = new Headers(init.headers || {});
  headers.delete('x-owner-write-token');
  headers.delete('x-owner-token');
  let body = init.body;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        delete parsed.ownerWriteToken;
        delete parsed.ownerToken;
        delete parsed.owner_token;
        delete parsed.owner_write_token;
        body = JSON.stringify(parsed);
      }
    } catch {
      // Non-JSON request bodies are preserved unchanged.
    }
  }
  return { ...init, headers, body };
}
