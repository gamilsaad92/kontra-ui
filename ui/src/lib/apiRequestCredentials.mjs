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
