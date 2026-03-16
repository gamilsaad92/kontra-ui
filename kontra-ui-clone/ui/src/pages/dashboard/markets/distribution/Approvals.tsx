import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";

type Approval = {
  id: string;
  object_type: string;
  object_id: string;
  status: string;
  assigned_to_role: string;
  notes?: string | null;
};

type AiSummary = {
  executive_summary: string;
  key_risks: string[];
  mitigants: string[];
  data_gaps: string[];
  confidence: string;
};

export default function Approvals() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);

  const loadApprovals = async () => {
    const response = await api.get("/market/approvals");
    setApprovals(response.data.approvals || []);
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const handleDecision = async (approvalId: string, decision: "approved" | "rejected") => {
    setStatus(null);
    try {
      await api.post(`/market/approvals/${approvalId}/decide`, { decision });
      setStatus(`Decision recorded: ${decision}`);
      loadApprovals();
    } catch (err: any) {
      setStatus(err?.response?.data?.message || "Unable to record decision");
    }
  };

  const handleLoadSummary = async (offeringId: string) => {
    setStatus(null);
    try {
      const response = await api.post(`/market/offerings/${offeringId}/ai/summary`);
      setAiSummary(response.data.summary);
    } catch (err: any) {
      setStatus(err?.response?.data?.message || "Unable to load AI summary");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Market approvals queue</h2>
        <p className="mt-2 text-sm text-slate-600">
          Compliance reviewers must approve offerings and large trades before listing or settlement.
        </p>
      </div>

      {status ? (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          {status}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {approvals.map((approval) => (
            <div key={approval.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {approval.object_type} · {approval.object_id}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {approval.status} · {approval.assigned_to_role}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDecision(approval.id, "approved")}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecision(approval.id, "rejected")}
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600"
                  >
                    Reject
                  </button>
                  {approval.object_type === "offering" ? (
                    <button
                      type="button"
                      onClick={() => handleLoadSummary(approval.object_id)}
                      className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-600"
                    >
                      AI risk summary
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">AI risk panel</h3>
          {aiSummary ? (
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">{aiSummary.executive_summary}</p>
              <div>
                <p className="text-xs uppercase text-slate-400">Key risks</p>
                <ul className="list-disc pl-5">
                  {aiSummary.key_risks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Mitigants</p>
                <ul className="list-disc pl-5">
                  {aiSummary.mitigants.map((mitigant) => (
                    <li key={mitigant}>{mitigant}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Data gaps</p>
                <ul className="list-disc pl-5">
                  {aiSummary.data_gaps.length ? aiSummary.data_gaps.map((gap) => <li key={gap}>{gap}</li>) : <li>None</li>}
                </ul>
              </div>
              <p className="text-xs uppercase text-slate-400">Confidence: {aiSummary.confidence}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Load an offering to view the advisory AI risk summary. This does not replace human
              approvals.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
