let currentOrgId: string | null = null;

export function setOrgId(orgId?: string | number | null): void {
  currentOrgId = orgId === null || orgId === undefined || orgId === "" ? null : String(orgId);

  if (typeof window !== "undefined") {
    if (currentOrgId) {
      window.localStorage.setItem("kontra:orgId", currentOrgId);
      window.sessionStorage.setItem("kontra:orgId", currentOrgId);
    } else {
      window.localStorage.removeItem("kontra:orgId");
      window.sessionStorage.removeItem("kontra:orgId");
    }
  }
}

export function getOrgId(): string | null {
  if (currentOrgId) {
    return currentOrgId;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const fromStorage =
    window.localStorage.getItem("kontra:orgId") ||
    window.sessionStorage.getItem("kontra:orgId");

  return fromStorage && fromStorage.trim() ? fromStorage : null;
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
