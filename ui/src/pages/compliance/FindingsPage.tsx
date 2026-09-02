import { useEffect, useState } from "react";
import { policyApi } from "../../lib/policyApi";

const reasonCodes = ["policy_exception", "doc_pending", "approved_extension", "data_error"];

export default function FindingsPage() {
  const [findings, setFindings] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [overrideAction, setOverrideAction] = useState("waive");
  const [reasonCode, setReasonCode] = useState(reasonCodes[0]);
  const [reason, setReason] = useState("");

  const refresh = async () => {
    const res = await policyApi.listFindings();
    setFindings(((res.data as any).findings || []) as any[]);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const markInProgress = async (id: string) => {
    await policyApi.updateFinding(id, { status: "in_progress" });
    await refresh();
  };

  const addOverride = async () => {
    if (!selected?.id) return;
    await policyApi.overrideFinding(selected.id, {
      action: overrideAction,
      reason_code: reasonCode,
      reason,
    });
    setReason("");
    await refresh();
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Compliance Findings</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th>Severity</th><th>Title</th><th>Entity</th><th>Due</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((f) => (
              <tr key={f.id} className="cursor-pointer border-t" onClick={() => setSelected(f)}>
                <td className="py-2">{f.severity}</td>
                <td>{f.title}</td>
                <td>{f.entity_id}</td>
                <td>{f.due_date || "—"}</td>
                <td>{f.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <aside className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2 font-semibold">Finding Detail</h3>
        {selected ? (
          <div className="space-y-3 text-sm">
            <p><span className="font-medium">Why triggered:</span></p>
            <pre className="max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(selected.details?.inputs_snapshot || {}, null, 2)}</pre>

            <p className="font-medium">Tasks</p>
            <ul className="list-disc pl-5">
              {(selected.tasks || []).map((t: any) => <li key={t.id}>{t.title} ({t.status})</li>)}
            </ul>

            <div className="flex gap-2">
              <button className="rounded bg-blue-600 px-3 py-1 text-white" onClick={() => markInProgress(selected.id)}>Mark In Progress</button>
            </div>

            <div className="space-y-2 rounded border p-2">
              <h4 className="font-medium">Add Override</h4>
              <select className="w-full rounded border p-1" value={overrideAction} onChange={(e) => setOverrideAction(e.target.value)}>
                {['waive','extend','dismiss','override_action'].map((a) => <option key={a}>{a}</option>)}
              </select>
              <select className="w-full rounded border p-1" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                {reasonCodes.map((c) => <option key={c}>{c}</option>)}
              </select>
              <textarea className="w-full rounded border p-1" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button className="rounded bg-emerald-600 px-3 py-1 text-white" onClick={addOverride}>Submit Override</button>
            </div>

            <button className="rounded bg-slate-100 px-3 py-1">Upload artifacts (coming soon)</button>
          </div>
        ) : <p className="text-sm text-slate-500">Select a finding to inspect details.</p>}
      </aside>
    </div>
  );
}
