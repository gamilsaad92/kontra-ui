const { z } = require('zod');

const entitySchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  status: z.string(),
  title: z.string().nullable().optional(),
  data: z.record(z.any()),
  created_at: z.string(),
  updated_at: z.string(),
});

const listQuerySchema = z.object({
  status: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

const createEntitySchema = z.object({
  title: z.string().optional(),
  status: z.string().optional(),
  data: z.record(z.any()).optional(),
});

const patchEntitySchema = createEntitySchema.partial();

const listResponseSchema = z.object({
  items: z.array(entitySchema),
  total: z.number().int().nonnegative(),
});

const memberSchema = z.object({
  id: z.string().uuid(),
 org_id: z.string().min(1),
  user_id: z.string(),
  role: z.string(),
  status: z.string(),
  title: z.string().nullable().optional(),
  data: z.record(z.any()),
  created_at: z.string(),
  updated_at: z.string(),
});

module.exports = {
  entitySchema,
  listQuerySchema,
  createEntitySchema,
  patchEntitySchema,
  listResponseSchema,
  memberSchema,
};
