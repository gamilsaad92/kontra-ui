const { z } = require('../lib/zod');

const borrowerKpiSchema = z.object({
  name: z.string(),
  value: z.union([z.number(), z.string()]).optional(),
  unit: z.string().optional(),
  target: z.union([z.number(), z.string()]).optional(),
  trend: z.string().optional(),
  delta_bps: z.number().optional(),
});
const dscrTrendPointSchema = z.object({ period: z.string(), dscr: z.number() });
const jsonRecordSchema = z.record(z.any());

const listingSchema = z.object({
  asset_type: z.string(),
  title: z.string().min(3),
  description: z.string().optional(),
  par_amount: z.number().positive(),
  min_piece: z.number().optional(),
  currency: z.string().default('USD'),
  rate_type: z.enum(['fixed', 'floating']),
  index_rate: z.string().optional(),
  spread_bps: z.number().int().optional(),
  coupon_bps: z.number().int().optional(),
  maturity_date: z.string().optional(),
  borrower_name: z.string().optional(),
  sector: z.string().optional(),
  geography: z.string().optional(),
  risk_rating: z.string().optional(),
  ltv: z.number().optional(),
  dscr: z.number().optional(),
  loan_id: z.string().optional(),
  asset_id: z.string().optional(),
  occupancy_rate: z.number().min(0).max(100).optional(),
  cashflow_summary: jsonRecordSchema.optional(),
  borrower_kpis: z.array(borrowerKpiSchema).max(100).optional(),
  marketplace_metrics: jsonRecordSchema.optional(),
  dscr_trend: z.array(dscrTrendPointSchema).max(120).optional(),
  payment_history_summary: jsonRecordSchema.optional(),
  visibility: z.enum(['network', 'private', 'invite_only']).default('network'),
  invitee_org_ids: z.array(z.string()).max(100).optional(),
  compliance_hold: z.boolean().default(true),
});
const listingUpdateSchema = listingSchema.omit({ compliance_hold: true }).partial();

const tradeSchema = z.object({ offer_id: z.number() });
const tradeUpdateSchema = z.object({
  settlement_date: z.string().optional(),
  documents: z.array(z.string()).max(100).optional(),
  status: z.string().optional(),
  docs_folder_id: z.string().optional(),
});

module.exports = { listingSchema, listingUpdateSchema, tradeSchema, tradeUpdateSchema };
