const OWNER_SESSION_ERROR = 'Could not establish secure room access. Please request a new code.';

function ownerSessionUrl(apiBase, propertyId, action) {
  return `${String(apiBase || '').replace(/\/+$/, '')}/api/public/deal-room/${encodeURIComponent(propertyId)}/owner-session/${action}`;
}

async function requestOwnerSession({ apiBase, propertyId, action, exchangeToken, fetchImpl }) {
  const response = await fetchImpl(ownerSessionUrl(apiBase, propertyId, action), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...(exchangeToken ? { body: JSON.stringify({ exchangeToken }) } : {}),
  });
  if (!response.ok) throw new Error(OWNER_SESSION_ERROR);
}

export async function exchangeMyDealRoomsOwnerSessions({
  rooms,
  exchangeTokens,
  apiBase = '',
  fetchImpl = fetch,
}) {
  const exchangedRooms = [];
  for (const room of rooms || []) {
    const propertyId = room?.property_id;
    const exchangeToken = propertyId ? exchangeTokens?.[propertyId] : null;
    if (!propertyId || typeof exchangeToken !== 'string' || !exchangeToken) {
      throw new Error(OWNER_SESSION_ERROR);
    }
    try {
      await requestOwnerSession({ apiBase, propertyId, action: 'exchange', exchangeToken, fetchImpl });
      exchangedRooms.push(room);
    } catch (error) {
      await logoutMyDealRoomsOwnerSessions({
        rooms: exchangedRooms,
        apiBase,
        fetchImpl,
      }).catch(() => {});
      throw error;
    }
  }
}

export async function logoutMyDealRoomsOwnerSessions({
  rooms,
  apiBase = '',
  fetchImpl = fetch,
}) {
  let failed = false;
  for (const room of rooms || []) {
    if (!room?.property_id) continue;
    try {
      await requestOwnerSession({ apiBase, propertyId: room.property_id, action: 'logout', fetchImpl });
    } catch {
      failed = true;
    }
  }
  if (failed) throw new Error(OWNER_SESSION_ERROR);
}
