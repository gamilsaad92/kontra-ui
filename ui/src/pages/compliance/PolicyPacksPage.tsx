import { useEffect, useState } from "react";
import { policyApi } from "../../lib/policyApi";

export default function PolicyPacksPage() {
  const [packs, setPacks] = useState<any[]>([]);
  const [regs, setRegs] = useState<any[]>([]);
  const [name, setName] = useState("Freddie Mac Pack");
  const [authority, setAuthority] = useState("freddie");
  const [message, setMessage] = useState("");

  const refresh = async () => {
    const [packsRes, regsRes] = await Promise.all([policyApi.listPacks(), policyApi.listRegulations()]);
    setPacks((packsRes.data as any).packs || []);
    setRegs((regsRes.data as any).regulations || []);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const createPack = async () => {
    await policyApi.createPack({ name, authority });
    setMessage("Pack created.");
    await refresh();
  };

  const seedFreddie = async () => {
    const packRes = await policyApi.createPack({ name: "Freddie Mac Pack", authority: "freddie" });
    const packId = (packRes.data as any).pack.id;

    const regRes = await policyApi.createRegulation({
      pack_id: packId,
      authority: "freddie",
      title: "High risk loans require earlier due date",
      citation: "Freddie Guide 40.2B",
      effective_date: "2026-03-31",
      status: "active",
    });

    await policyApi.createRule({
      pack_id: packId,
      regulation_id: (regRes.data as any).regulation.id,
      name: "High risk loans require earlier due date",
      severity: "high",
      conditions: {
        any: [
          { field: "loan.risk_rating", op: ">", value: 6 },
          { field: "loan.special_product", op: "=", value: true },
        ],
      },
      actions: [
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
      ],
    });

    setMessage("Freddie sample pack/rule seeded. Activate from Rule Builder.");
    await refresh();
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Policy Center · Packs & Regulations</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <input className="rounded border p-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pack name" />
        <input className="rounded border p-2" value={authority} onChange={(e) => setAuthority(e.target.value)} placeholder="authority" />
        <button className="rounded bg-slate-900 px-3 py-2 text-white" onClick={createPack}>Create Pack</button>
      </div>
      <button className="rounded bg-blue-600 px-3 py-2 text-white" onClick={seedFreddie}>Seed Freddie Sample Rule</button>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <div>
          <h3 className="mb-2 font-medium">Policy Packs</h3>
          <ul className="space-y-1">
            {packs.map((p) => <li key={p.id} className="rounded border p-2">{p.name} · {p.authority} · {p.status}</li>)}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 font-medium">Regulations Registry</h3>
          <ul className="space-y-1">
            {regs.map((r) => <li key={r.id} className="rounded border p-2">{r.title} · {r.citation || "—"}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
