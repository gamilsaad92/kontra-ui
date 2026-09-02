import { useEffect, useMemo, useState } from "react";
import { policyApi } from "../../lib/policyApi";

const defaultConditions = {
  any: [
    { field: "loan.risk_rating", op: ">", value: 6 },
    { field: "loan.special_product", op: "=", value: true },
  ],
};

const defaultActions = [
  { type: "set_due_date", mode: "fixed", value: "2026-03-31" },
  {
    type: "create_finding",
    title: "High risk loan requires 3/31/2026 due date",
    severity: "high",
  },
  {
    type: "create_task",
    title: "Update reporting due date to 3/31/2026",
    sla_days: 7,
    required_artifacts: ["Freddie Guide citation", "Borrower notice or internal memo"],
  },
];

export default function PolicyRulesPage() {
  const [packs, setPacks] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [selectedPack, setSelectedPack] = useState<string>("");
  const [name, setName] = useState("High risk loans require earlier due date");
  const [severity, setSeverity] = useState("high");
  const [regulationId, setRegulationId] = useState("");
  const [conditionsText, setConditionsText] = useState(JSON.stringify(defaultConditions, null, 2));
  const [actionsText, setActionsText] = useState(JSON.stringify(defaultActions, null, 2));
  const [message, setMessage] = useState<string>("");
  const [impactRun, setImpactRun] = useState<any | null>(null);

  const selectedRule = useMemo(() => rules[0], [rules]);

  const refresh = async () => {
    const packsRes = await policyApi.listPacks();
    const packsList = (packsRes.data as any).packs || [];
    setPacks(packsList);

    const activePack = selectedPack || packsList[0]?.id || "";
    if (activePack && !selectedPack) setSelectedPack(activePack);

    const rulesRes = await policyApi.listRules(activePack || undefined);
    setRules((rulesRes.data as any).rules || []);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const parseEditorJson = () => {
    const conditions = JSON.parse(conditionsText);
    const actions = JSON.parse(actionsText);
    return { conditions, actions };
  };

  const handleCreateRule = async () => {
    try {
      const { conditions, actions } = parseEditorJson();
      const res = await policyApi.createRule({
        pack_id: selectedPack,
        regulation_id: regulationId || null,
        name,
        severity,
        conditions,
        actions,
      });
      setMessage(`Draft saved. Rule ${((res.data as any).rule || {}).name} created.`);
      await refresh();
    } catch (error) {
      setMessage(`JSON invalid or save failed: ${(error as Error).message}`);
    }
  };

  const runImpactPreview = async () => {
    if (!selectedRule?.policy_rule_versions?.length) {
      setMessage("No version available for impact run.");
      return;
    }
    const versionId = selectedRule.policy_rule_versions[0].id;
    const run = await policyApi.runImpact({ rule_version_id: versionId });
    const runId = (run.data as any).run_id;
    const detail = await policyApi.getImpact(runId);
    setImpactRun((detail.data as any) || null);
  };

  const submitRule = async () => {
    if (!selectedRule?.id) return;
    await policyApi.submitRule(selectedRule.id);
    setMessage("Rule submitted for review.");
    await refresh();
  };

  const approveRule = async () => {
    const versionId = selectedRule?.policy_rule_versions?.[0]?.id;
    if (!versionId) return;
    await policyApi.approveVersion(versionId);
    setMessage("Version approved.");
    await refresh();
  };

  const activateRule = async () => {
    const versionId = selectedRule?.policy_rule_versions?.[0]?.id;
    if (!versionId) return;
    await policyApi.activateVersion(versionId);
    setMessage("Version activated.");
    await refresh();
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Policy Center · Rules Builder</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          Policy Pack
          <select className="mt-1 w-full rounded border p-2" value={selectedPack} onChange={(e) => setSelectedPack(e.target.value)}>
            {packs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Rule name
          <input className="mt-1 w-full rounded border p-2" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          Regulation ID (optional)
          <input className="mt-1 w-full rounded border p-2" value={regulationId} onChange={(e) => setRegulationId(e.target.value)} />
        </label>
        <label className="text-sm">
          Severity
          <select className="mt-1 w-full rounded border p-2" value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {['low','medium','high','critical'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          Conditions JSON
          <textarea className="mt-1 h-56 w-full rounded border p-2 font-mono text-xs" value={conditionsText} onChange={(e) => setConditionsText(e.target.value)} />
        </label>
        <label className="text-sm">
          Actions JSON
          <textarea className="mt-1 h-56 w-full rounded border p-2 font-mono text-xs" value={actionsText} onChange={(e) => setActionsText(e.target.value)} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="rounded bg-slate-900 px-3 py-2 text-white" onClick={handleCreateRule}>Save draft</button>
        <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={runImpactPreview}>Run Impact Preview</button>
        <button className="rounded bg-amber-600 px-3 py-2 text-white" onClick={submitRule}>Submit for Review</button>
        <button className="rounded bg-emerald-600 px-3 py-2 text-white" onClick={approveRule}>Approve</button>
        <button className="rounded bg-purple-600 px-3 py-2 text-white" onClick={activateRule}>Activate</button>
      </div>

      {message ? <p className="text-sm text-slate-600">{message}</p> : null}

      {impactRun ? (
        <div className="rounded border border-slate-200 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium">Impact Preview</h3>
            <button className="text-sm text-slate-500" onClick={() => setImpactRun(null)}>Close</button>
          </div>
          <pre className="max-h-72 overflow-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(impactRun.run?.summary, null, 2)}</pre>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 font-medium">Rules in selected pack</h3>
        <ul className="space-y-2 text-sm">
          {rules.map((r) => (
            <li key={r.id} className="rounded border p-2">
              {r.name} · status: {r.status} · versions: {r.policy_rule_versions?.length || 0}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
