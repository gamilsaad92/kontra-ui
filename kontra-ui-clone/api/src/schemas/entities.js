const { z } = require('zod');

// Supabase tables fall into two families:
//   • "legacy" tables (assets, loans, inspections, payments, escrows…) — integer PKs,
//     org_id added as uuid by migration, updated_at may be null on old rows
//   • "canonical" tables (pools, draws, tokens…) — uuid PKs, org_id uuid NOT NULL
//
// The schema below accepts both so the API never returns a 400 due to mismatched types.

const flexId = z.union([z.string(), z.number()]).transform((v) => String(v));
const flexTimestamp = z.string().nullable().optional();

const entitySchema = z.object({
  id: flexId,
  org_id: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
  // Organizations use "name" instead of "title"
  name: z.string().nullable().optional(),
  status: z.string().default('active'),
  title: z.string().nullable().optional(),
  data: z.record(z.any()).optional().default({}),
  created_at: flexTimestamp,
  updated_at: flexTimestamp,
});

const listQuerySchema = z.object({
  status: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

const createEntitySchema = z.object({
  title: z.string().optional(),
  name: z.string().optional(),
  status: z.string().optional(),
  data: z.record(z.any()).optional(),
});

const patchEntitySchema = createEntitySchema.partial();

const listResponseSchema = z.object({
  items: z.array(entitySchema),
  total: z.number().int().nonnegative(),
});

const memberSchema = z.object({
  id: flexId,
  org_id: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
  user_id: z.string(),
  role: z.string(),
  status: z.string().optional(),
  title: z.string().nullable().optional(),
  data: z.record(z.any()).optional().default({}),
  created_at: flexTimestamp,
  updated_at: flexTimestamp,
});

module.exports = {
  entitySchema,
  listQuerySchema,
  createEntitySchema,
  patchEntitySchema,
  listResponseSchema,
  memberSchema,
};
