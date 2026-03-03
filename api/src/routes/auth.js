const express = require('express');
const authenticate = require('../../middlewares/authenticate');
const { queryOne } = require('../lib/appDb');

const router = express.Router();
router.use(authenticate);

router.post('/bootstrap', async (req, res) => {
  const supabaseUserId = req.user?.supabaseUserId || req.user?.id;
  const email = req.user?.email || null;

  if (!supabaseUserId) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing auth' });
  }

  try {
    const result = await queryOne(
      `WITH upserted_user AS (
         INSERT INTO users (supabase_user_id, email, name)
         VALUES ($1::uuid, COALESCE($2, 'unknown@example.com'), NULL)
         ON CONFLICT (supabase_user_id)
         DO UPDATE SET email = EXCLUDED.email
         RETURNING id, supabase_user_id, email, name, created_at
       ), existing_membership AS (
         SELECT om.*
         FROM org_memberships om
         JOIN upserted_user u ON u.id = om.user_id
         ORDER BY om.created_at ASC
         LIMIT 1
       ), created_org AS (
         INSERT INTO organizations (name)
         SELECT CONCAT(COALESCE((SELECT email FROM upserted_user), 'User'), '''s Organization')
         WHERE NOT EXISTS (SELECT 1 FROM existing_membership)
         RETURNING id, name, created_at
       ), ensured_membership AS (
         INSERT INTO org_memberships (org_id, user_id, role)
         SELECT created_org.id, upserted_user.id, 'owner'
         FROM created_org, upserted_user
         RETURNING id, org_id, user_id, role, created_at
       ), selected_membership AS (
         SELECT id, org_id, user_id, role, created_at FROM existing_membership
         UNION ALL
         SELECT id, org_id, user_id, role, created_at FROM ensured_membership
         LIMIT 1
       )
       SELECT
         row_to_json(upserted_user.*) AS "user",
         row_to_json(org.*) AS "org",
         row_to_json(selected_membership.*) AS "membership"
       FROM upserted_user
       JOIN selected_membership ON true
       JOIN organizations org ON org.id = selected_membership.org_id`,
      [supabaseUserId, email]
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error('[AuthBootstrap] Failed to bootstrap user', error);
    return res.status(500).json({ code: 'BOOTSTRAP_FAILED', message: 'Unable to bootstrap account' });
  }
});

module.exports = router;
