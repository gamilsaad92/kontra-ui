// Lightweight session analytics helper.
// Fires fire-and-forget events to /api/track — never throws, never blocks the user.

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

function getSessionId() {
  try {
    let id = sessionStorage.getItem("kontra_session_id");
    if (!id) {
      id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      sessionStorage.setItem("kontra_session_id", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export function trackEvent(eventName, properties = {}) {
  try {
    const body = {
      session_id:  getSessionId(),
      event_name:  eventName,
      workspace_id: properties.workspace_id || null,
      properties,
    };
    fetch(`${API_BASE}/api/track`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    }).catch(() => {});
  } catch { /* never propagate */ }
}
