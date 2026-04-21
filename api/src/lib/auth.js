function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload);
  } catch (_error) {
    return null;
  }
}

function getAuthUserId(req) {
  const reqUserId = req?.user?.id || req?.user?.sub;
  if (typeof reqUserId === 'string' && reqUserId.trim()) {
    return reqUserId;
  }

  const authHeader = req?.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const payload = decodeJwtPayload(authHeader.slice(7));
  if (typeof payload?.sub === 'string' && payload.sub.trim()) {
    return payload.sub;
  }

  return null;
}

module.exports = { getAuthUserId };
