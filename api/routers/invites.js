'use strict';

const express = require('express');
const router = express.Router();

// The old bearer-token invite endpoint wrote to a separate organization_invites
// table and organization_members relation. Team invitations now use Supabase
// Auth plus canonical org_memberships through /api/onboarding/invite.
router.use((_req, res) => res.status(410).json({
  code: 'LEGACY_ORGANIZATION_INVITES_DISABLED',
  message: 'Use the authenticated organization onboarding invitation flow.',
}));

module.exports = router;
