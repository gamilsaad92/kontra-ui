/**
 * dbBootstrap.js — One-time DB setup for production.
 *
 * Creates required tables and seeds demo users if the users table is empty.
 * Safe to run on every startup (all DDL is idempotent).
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getPool } = require('./pgAdapter');

const DEMO_ORG_ID = 'a0000000-0000-0000-0000-000000000001';

const DEMO_USERS = [
  {
    id: 'e7bd29bd-6266-4cb9-8de0-2a0657710359',
    email: 'replit@kontraplatform.com',
    first_name: 'Alex',
    last_name: 'Lender',
    role: 'lender_admin',
    portal: 'lender',
    org_id: DEMO_ORG_ID,
    password: '12345678',
  },
  {
    id: 'f8ce30ce-7377-5dc0-9ef1-3b1768821460',
    email: 'servicer@kontraplatform.com',
    first_name: 'Sam',
    last_name: 'Servicer',
    role: 'servicer',
    portal: 'servicer',
    org_id: DEMO_ORG_ID,
    password: '12345678',
  },
  {
    id: 'a9df41df-8488-6ed1-af02-4c2879932571',
    email: 'investor@kontraplatform.com',
    first_name: 'Ivy',
    last_name: 'Investor',
    role: 'investor',
    portal: 'investor',
    org_id: DEMO_ORG_ID,
    password: '12345678',
  },
  {
    id: 'b0ea52e0-9599-7fe2-b013-5d3980a43682',
    email: 'borrower@kontraplatform.com',
    first_name: 'Ben',
    last_name: 'Borrower',
    role: 'borrower',
    portal: 'borrower',
    org_id: DEMO_ORG_ID,
    password: '12345678',
  },
];

async function bootstrap() {
  const pool = getPool();
  if (!pool) {
    console.warn('[dbBootstrap] No DB pool available — skipping bootstrap');
    return;
  }

  try {
    // 1. Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text UNIQUE NOT NULL,
        password_hash text NOT NULL,
        first_name text,
        last_name text,
        role text NOT NULL DEFAULT 'borrower',
        portal text,
        org_id uuid REFERENCES organizations(id),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash text UNIQUE NOT NULL,
        expires_at timestamptz NOT NULL,
        created_at timestamptz DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS user_dashboard_layout (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id text NOT NULL,
        org_id uuid,
        layout_key text NOT NULL DEFAULT 'home',
        layout_json jsonb DEFAULT '[]',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);

    // 2. Seed demo org
    await pool.query(`
      INSERT INTO organizations (id, name)
      VALUES ($1, 'Kontra Demo Org')
      ON CONFLICT (id) DO NOTHING
    `, [DEMO_ORG_ID]);

    // 3. Check if users exist
    const { rows } = await pool.query('SELECT COUNT(*) FROM users');
    const userCount = parseInt(rows[0].count, 10);

    if (userCount === 0) {
      console.log('[dbBootstrap] Seeding demo users...');
      for (const u of DEMO_USERS) {
        const hash = await bcrypt.hash(u.password, 12);
        await pool.query(`
          INSERT INTO users (id, email, password_hash, first_name, last_name, role, portal, org_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (email) DO NOTHING
        `, [u.id, u.email, hash, u.first_name, u.last_name, u.role, u.portal, u.org_id]);
      }
      console.log('[dbBootstrap] Seeded', DEMO_USERS.length, 'demo users');
    } else {
      console.log('[dbBootstrap] Users already exist (', userCount, '), skipping seed');
    }

    console.log('[dbBootstrap] Bootstrap complete');
  } catch (err) {
    console.error('[dbBootstrap] Error:', err.message);
  }
}

module.exports = { bootstrap };
