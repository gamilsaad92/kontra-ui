import { useState } from "react";
import { useServicingContext } from "./ServicingContext";

const transactions = [
  { id: "tx-1", date: "2024-05-14", type: "Tax payment", amount: -32000, balance: 118000 },
  { id: "tx-2", date: "2024-05-01", type: "Borrower deposit", amount: 42000, balance: 150000 },
  { id: "tx-3", date: "2024-04-19", type: "Insurance premium", amount: -18000, balance: 108000 },
];

export default function ServicingEscrowPage() {
  const { addAlert, addTask, logAudit, requestApproval } = useServicingContext();
  const [reconciled, setReconciled] = useState(false);

  const handleReconcile = () => {
    setReconciled(true);
    addAlert({
      id: "alert-escrow-reconciled",
      title: "Escrow reconciliation completed",
      detail: "Reconciliation flagged a projected shortage in September.",
      severity: "medium",
      category: "Escrow",
    });
    addTask({
      id: "task-escrow-shortage",
      title: "Resolve escrow shortage plan",
      detail: "Coordinate borrower cure for projected $42,000 shortfall.",
      status: "open",
      category: "Escrow",
    });
    logAudit({
      id: `audit-escrow-${Date.now()}`,
      action: "Escrow reconciliation run",
      detail: "Reconciled balances and updated shortage projections.",
      timestamp: new Date().toISOString(),
      status: "logged",
    });
  };

  const handleDisbursementApproval = () => {
    requestApproval(
      "Approve escrow disbursement",
      "Release insurance premium payment to carrier."
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Escrow account tracking</h2>
        <p className="mt-1 text-sm text-slate-500">
          Monitor balances, transactions, reconciliations, and shortage alerts.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">Current balance</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">$118,000</p>
            <p className="text-xs text-slate-500">Last updated 2 hours ago</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">Projected shortage</p>
            <p className="mt-2 text-xl font-semibold text-rose-600">$42,000</p>
            <p className="text-xs text-slate-500">Projected for Sep 2024</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">Reconciliation status</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {reconciled ? "Complete" : "Pending"}
            </p>
            <p className="text-xs text-slate-500">Run reconciliation before next disbursement.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleReconcile}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Run reconciliation
          </button>
          <button
            type="button"
            onClick={handleDisbursementApproval}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900"
          >
            Request disbursement approval
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Transactions</h3>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-700">{tx.date}</td>
                  <td className="px-4 py-3 text-slate-700">{tx.type}</td>
                  <td
                    className={`px-4 py-3 text-right ${
                      tx.amount < 0 ? "text-rose-600" : "text-emerald-600"
                    }`}
                  >
                    {tx.amount < 0 ? "-" : "+"}${Math.abs(tx.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    ${tx.balance.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        Escrow shortage alert: projected deficit exceeds policy thresholds. Human approval is required
        before sending borrower cure notices or scheduling disbursements.
      </section>
    </div>
  );
}
