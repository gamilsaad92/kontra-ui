let currentOrgId: string | null = null;

export function setOrgId(orgId?: string | number | null): void {
  currentOrgId = orgId === null || orgId === undefined || orgId === "" ? null : String(orgId);
}

export function getOrgId(): string | null {
   return currentOrgId;
}

export function requireOrgId(): string {
  const orgId = getOrgId();
  if (!orgId) {
    const error = new Error("Select an organization to continue") as Error & {
      code?: string;
      status?: number;
    };
    error.code = "ORG_CONTEXT_MISSING";
    error.status = 400;
    throw error;
  }

  return orgId;
}
