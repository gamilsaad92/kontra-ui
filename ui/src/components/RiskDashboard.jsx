import React, { useEffect, useState } from "react";
import { getRiskSummary } from "../services/analytics";

export default function RiskDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getRiskSummary().then(setData).catch(() => setData(null));
  }, []);

  if (!data) {
    return <div>Loading...</div>;
  }

  const { buckets, stress, flags, penalties } = data;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-medium text-slate-600 mb-2">Risk Buckets</h3>
        <ul className="space-y-1">
          {buckets.map((b) => (
            <li key={b.label}> {b.label}: {b.value} </li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-medium text-slate-600 mb-2">Stress Test ({stress?.scenario})</h3>
        <ul className="space-y-1">
          {(stress?.buckets || []).map((b) => (
            <li key={b.label}>{b.label}: {b.value}</li>
          ))}
        </ul>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-medium text-slate-600 mb-2">Insurance & Tax Flags</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1 font-medium">Type</th>
              <th className="py-1 font-medium">ID</th>
              <th className="py-1 font-medium">Due</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {flags.length === 0 && (
              <tr>
                <td className="py-1" colSpan={3}>None</td>
              </tr>
            )}
            {flags.map((f) => (
              <tr key={f.type + f.id}>
                <td className="py-1">{f.type}</td>
                <td className="py-1">{f.id}</td>
                <td className="py-1">{f.due}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-medium text-slate-600 mb-2">Default Interest & Penalties</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1 font-medium">Loan</th>
              <th className="py-1 font-medium">Default Interest</th>
              <th className="py-1 font-medium">Penalty</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {penalties.length === 0 && (
              <tr>
                <td className="py-1" colSpan={3}>None</td>
              </tr>
            )}
            {penalties.map((p) => (
              <tr key={p.id}>
                <td className="py-1">{p.id}</td>
                <td className="py-1">{p.defaultInterest.toFixed(2)}</td>
                <td className="py-1">{p.penalty.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
