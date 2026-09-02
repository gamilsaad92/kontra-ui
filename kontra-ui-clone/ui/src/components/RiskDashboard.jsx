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

 const {
    buckets,
    stress,
    flags,
    penalties,
    occupancyDerivatives,
    maintenanceSwaps,
    prepaymentSwaps,
  } = data;

  return (
    <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-slate-600">
              Occupancy Derivatives
            </h3>
            <p className="text-xs text-slate-500">
              Monitor occupancy triggers and hedge downside exposure with internal or DEX-settled contracts.
            </p>
          </div>
          <button className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg shadow-sm hover:bg-slate-700">
            Launch Trade Ticket
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1 font-medium">Contract</th>
              <th className="py-1 font-medium">Property</th>
              <th className="py-1 font-medium">Trigger</th>
              <th className="py-1 font-medium">Coverage</th>
              <th className="py-1 font-medium">Premium</th>
              <th className="py-1 font-medium">Venue</th>
              <th className="py-1 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {occupancyDerivatives.map((contract) => {
              const actionLabel =
                contract.side === "Sell" ? "Provide Coverage" : "Buy Protection";
              return (
                <tr key={contract.id} className="border-t border-slate-100">
                  <td className="py-2 pr-3">{contract.id}</td>
                  <td className="py-2 pr-3">{contract.property}</td>
                  <td className="py-2 pr-3">{contract.trigger}</td>
                  <td className="py-2 pr-3">{contract.coverage}</td>
                  <td className="py-2 pr-3">{contract.premium}</td>
                  <td className="py-2 pr-3">{contract.venue}</td>
                  <td className="py-2 text-right">
                    <button className="inline-flex items-center px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50">
                      {actionLabel}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
      
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-slate-600">R&M Cost Swaps</h3>
            <p className="text-xs text-slate-500">
              Forecast repairs and cap exposure by matching with cost-sharing counterparties.
            </p>
          </div>
          <button className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg shadow-sm hover:bg-slate-700">
            Create Swap
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1 font-medium">ID</th>
              <th className="py-1 font-medium">Asset</th>
              <th className="py-1 font-medium">Forecast</th>
              <th className="py-1 font-medium">Cap</th>
              <th className="py-1 font-medium">Counterparty</th>
              <th className="py-1 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {maintenanceSwaps.map((swap) => (
              <tr key={swap.id} className="border-t border-slate-100">
                <td className="py-2 pr-3">{swap.id}</td>
                <td className="py-2 pr-3">{swap.asset}</td>
                <td className="py-2 pr-3">{swap.forecast}</td>
                <td className="py-2 pr-3">{swap.cap}</td>
                <td className="py-2 pr-3">{swap.counterparty}</td>
                <td className="py-2 text-right">
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-600">
                    {swap.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-slate-600">Prepayment Option Swaps</h3>
            <p className="text-xs text-slate-500">
              Price prepayment penalties upfront and transfer exposure to aligned counterparties.
            </p>
          </div>
          <button className="px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg shadow-sm hover:bg-slate-700">
            Structure Swap
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1 font-medium">ID</th>
              <th className="py-1 font-medium">Loan</th>
              <th className="py-1 font-medium">Penalty</th>
              <th className="py-1 font-medium">Window</th>
              <th className="py-1 font-medium">Counterparty</th>
              <th className="py-1 font-medium text-right">Upfront Fee</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {prepaymentSwaps.map((swap) => (
              <tr key={swap.id} className="border-t border-slate-100">
                <td className="py-2 pr-3">{swap.id}</td>
                <td className="py-2 pr-3">{swap.loan}</td>
                <td className="py-2 pr-3">{swap.penalty}</td>
                <td className="py-2 pr-3">{swap.window}</td>
                <td className="py-2 pr-3">{swap.counterparty}</td>
                <td className="py-2 text-right">{swap.fee}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
