'use strict';

// These generic /api routers own no Deal Room endpoints. Let the dedicated
// public Deal Room handlers apply their own verified session authorization.
function skipPublicDealRoomRouter(req, res, next) {
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  if (path.startsWith('/api/public/deal-room/')) return next('router');
  return next();
}

module.exports = skipPublicDealRoomRouter;
