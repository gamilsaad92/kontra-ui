export type CanonicalEntity = {
  id: string;
  org_id: string;
  status: string;
  title?: string | null;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EntityListResponse = {
  items: CanonicalEntity[];
  total: number;
};
