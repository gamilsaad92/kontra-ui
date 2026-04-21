import { api } from "./apiClient";

export const policyApi = {
  listPacks: () => api.get("/api/policy/packs"),
  createPack: (p: { name: string; authority: string; description?: string }) => api.post("/api/policy/packs", p),

  listRegulations: () => api.get("/api/policy/regulations"),
  createRegulation: (p: unknown) => api.post("/api/policy/regulations", p),

  listRules: (pack_id?: string) => api.get(`/api/policy/rules${pack_id ? `?pack_id=${pack_id}` : ""}`),
  createRule: (p: unknown) => api.post("/api/policy/rules", p),
  newVersion: (ruleId: string, p: unknown) => api.post(`/api/policy/rules/${ruleId}/versions`, p),
  submitRule: (ruleId: string) => api.post(`/api/policy/rules/${ruleId}/submit`, {}),
  approveVersion: (versionId: string) => api.post(`/api/policy/versions/${versionId}/approve`, {}),
  activateVersion: (versionId: string) => api.post(`/api/policy/versions/${versionId}/activate`, {}),

  runImpact: (p: { rule_version_id: string }) => api.post("/api/policy/impact/run", p),
  getImpact: (runId: string) => api.get(`/api/policy/impact/${runId}`),

  evaluateLoan: (loan_id: string) => api.post("/api/policy/evaluate", { entity_type: "loan", entity_id: loan_id }),
  listFindings: () => api.get("/api/policy/findings"),
  updateFinding: (finding_id: string, p: unknown) => api.patch(`/api/policy/findings/${finding_id}`, p),
  overrideFinding: (finding_id: string, p: unknown) => api.post(`/api/policy/findings/${finding_id}/override`, p),
};
