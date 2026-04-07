import { useState } from 'react';
import { useServicingContext } from './ServicingContext';

type DrawStatus = 'draft' | 'submitted' | 'ai-review' | 'approved' | 'funded' | 'rejected';

type LineItem = { description: string; sov_pct: number; inspector_pct: number; amount: number };
type Invoice = { vendor: string; amount: number; date: string; approved: boolean };
type LienWaiver = { vendor: string; type: 'conditional' | 'unconditional'; received: boolean };

type Draw = {
  id: string;
  draw_number: number;
  property_name: string;
  requested_amount: number;
  contract_amount: number;
  prior_draw_total: number;
  status: DrawStatus;
  inspector_cert: boolean;
  invoices: Invoice[];
  lien_waivers: LienWaiver[];
  line_items: LineItem[];
  ai_issues: { code: string; severity: string; message: string }[];
  ai_status: 'pass' | 'fail' | 'needs_review' | null;
};

const DEMO_DRAWS: Draw[] = [
  {
    id: '1',
    draw_number: 3,
    property_name: 'Maple Ridge Apartments',
    requested_amount: 285000,
    contract_amount: 1200000,
    prior_draw_total: 540000,
    status: 'ai-review',
    inspector_cert: true,
    invoices: [
      { vendor: 'ABC Roofing', amount: 150000, date: '2026-03-01', approved: true },
      { vendor: 'DEF Electrical', amount: 85000, date: '2026-03-05', approved: true },
      { vendor: 'GHI Plumbing', amount: 50000, date: '2026-03-08', approved: false },
    ],
    lien_waivers: [
      { vendor: 'ABC Roofing', type: 'conditional', received: true },
      { vendor: 'DEF Electrical', type: 'conditional', received: true },
      { vendor: 'GHI Plumbing', type: 'conditional', received: false },
    ],
    line_items: [
      { description: 'Roof replacement', sov_pct: 40, inspector_pct: 38, amount: 150000 },
      { description: 'Electrical panel upgrades', sov_pct: 22, inspector_pct: 22, amount: 85000 },
      { description: 'Plumbing renovation', sov_pct: 15, inspector_pct: 12, amount: 50000 },
    ],
    ai_issues: [
      { code: 'LIEN_WAIVER_MISSING', severity: 'high', message: 'Missing conditional lien waiver for GHI Plumbing ($50,000).' },
      { code: 'SOV_INSPECTOR_VARIANCE', severity: 'medium', message: 'Plumbing SOV 15% vs inspector 12% — 3% variance exceeds 2% threshold.' },
    ],
    ai_status: 'fail',
  },
  {
    id: '2',
    draw_number: 2,
    property_name: 'Riverside Commons',
    requested_amount: 180000,
    contract_amount: 750000,
    prior_draw_total: 210000,
    status: 'approved',
    inspector_cert: true,
    invoices: [
      { vendor: 'Summit Contractors', amount: 180000, date: '2026-02-15', approved: true },
    ],
    lien_waivers: [
      { vendor: 'Summit Contractors', type: 'conditional', received: true },
    ],
    line_items: [
      { description: 'Foundation work', sov_pct: 28, inspector_pct: 28, amount: 180000 },
    ],
    ai_issues: [],
    ai_status: 'pass',
  },
];

const statusBadge = (s: DrawStatus) => {
  const map: Record<DrawStatus, string> = {
    draft: 'bg-slate-100 text-slate-600',
    submitted: 'bg-blue-100 text-blue-700',
    'ai-review': 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    funded: 'bg-purple-100 text-purple-700',
    rejected: 'bg-brand-100 text-brand-700',
  };
  return map[s] || 'bg-slate-100 text-slate-600';
};

const aiStatusBadge = (s: string | null) => {
  if (s === 'pass') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (s === 'fail') return 'bg-brand-50 text-brand-700 border border-brand-200';
  if (s === 'needs_review') return 'bg-amber-50 text-amber-700 border border-amber-200';
  return 'bg-slate-100 text-slate-500';
};

const severityColor = (s: string) => {
  if (s === 'high') return 'text-brand-700 bg-brand-50';
  if (s === 'medium') return 'text-amber-700 bg-amber-50';
  return 'text-slate-600 bg-slate-50';
};

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function ServicingDrawsPage() {
  const { logAudit } = useServicingContext();
  const [draws] = useState<Draw[]>(DEMO_DRAWS);
  const [selected, setSelected] = useState<Draw | null>(null);
  const [runningAI, setRunningAI] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);

  const handleRunAI = async (draw: Draw) => {
    setRunningAI(true);
    setNarrative(null);
    await new Promise((r) => setTimeout(r, 1200));
    setRunningAI(false);
    logAudit({
      id: `ai-draw-${draw.id}-${Date.now()}`,
      action: `AI draw review triggered — Draw #${draw.draw_number}`,
      detail: draw.property_name,
      timestamp: new Date().toISOString(),
      status: draw.ai_status === 'pass' ? 'approved' : 'pending-approval',
    });
  };

  const handleGenerateNarrative = (draw: Draw) => {
    const pct = ((draw.prior_draw_total + draw.requested_amount) / draw.contract_amount * 100).toFixed(1);
    const lienIssue = draw.lien_waivers.some((w) => !w.received);
    const sovIssue = draw.ai_issues.some((i) => i.code === 'SOV_INSPECTOR_VARIANCE');
    setNarrative(
      `Draw #${draw.draw_number} — ${draw.property_name}\n\n` +
      `A draw request in the amount of ${fmt(draw.requested_amount)} has been submitted for ${draw.property_name}. ` +
      `Cumulative disbursements total ${fmt(draw.prior_draw_total + draw.requested_amount)}, representing ${pct}% of the ${fmt(draw.contract_amount)} rehabilitation contract.\n\n` +
      `Inspector Certification: ${draw.inspector_cert ? 'Received — work in place confirmed.' : 'NOT received — disbursement hold recommended.'}\n\n` +
      (lienIssue ? `Lien Waiver Exception: One or more conditional lien waivers are outstanding. Disbursement should be withheld pending receipt.\n\n` : 'Lien Waivers: All required conditional lien waivers received.\n\n') +
      (sovIssue ? `SOV/Inspector Variance: A variance exceeding the 2% threshold was identified on one or more line items. Inspector reconciliation required prior to approval.\n\n` : '') +
      `Recommendation: ${draw.ai_status === 'pass' ? 'Draw package is complete. Approved for funding subject to standard closing conditions.' : 'Draw package has open exceptions. Disbursement on hold pending resolution of identified items.'}`
    );
  };

  const handleApprove = (draw: Draw) => {
    logAudit({
      id: `draw-approve-${draw.id}-${Date.now()}`,
      action: `Draw #${draw.draw_number} approved for funding`,
      detail: `${draw.property_name} — ${fmt(draw.requested_amount)}`,
      timestamp: new Date().toISOString(),
      status: 'approved',
    });
    alert(`Draw #${draw.draw_number} approved.`);
  };

  const handleReturn = (draw: Draw) => {
    logAudit({
      id: `draw-return-${draw.id}-${Date.now()}`,
      action: `Draw #${draw.draw_number} returned to borrower`,
      detail: `${draw.property_name} — exceptions outstanding`,
      timestamp: new Date().toISOString(),
      status: 'pending-approval',
    });
    alert(`Draw #${draw.draw_number} returned to borrower for exception cure.`);
  };

  const drawInDetail = selected ?? draws[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Draw requests</h3>
        {draws.map((draw) => (
          <button
            key={draw.id}
            onClick={() => { setSelected(draw); setNarrative(null); }}
            className={`w-full rounded-xl border p-3 text-left transition ${
              drawInDetail.id === draw.id
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <p className={`text-sm font-semibold ${drawInDetail.id === draw.id ? 'text-white' : 'text-slate-900'}`}>
                {draw.property_name}
              </p>
              <span className={`flex-none rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(draw.status)}`}>
                {draw.status.replace('-', ' ')}
              </span>
            </div>
            <p className={`mt-1 text-xs ${drawInDetail.id === draw.id ? 'text-slate-300' : 'text-slate-500'}`}>
              Draw #{draw.draw_number} · {fmt(draw.requested_amount)}
            </p>
          </button>
        ))}
      </aside>

      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Draw #{drawInDetail.draw_number} — {drawInDetail.property_name}
            </h2>
            <p className="text-sm text-slate-500">
              Requested {fmt(drawInDetail.requested_amount)} of {fmt(drawInDetail.contract_amount)} contract ·{' '}
              {((drawInDetail.prior_draw_total + drawInDetail.requested_amount) / drawInDetail.contract_amount * 100).toFixed(1)}% cumulative
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleRunAI(drawInDetail)}
              disabled={runningAI}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
            >
              {runningAI ? 'Running AI…' : 'Run AI Review'}
            </button>
            <button
              onClick={() => handleGenerateNarrative(drawInDetail)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Generate Narrative
            </button>
            {drawInDetail.ai_status === 'pass' && (
              <button
                onClick={() => handleApprove(drawInDetail)}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Approve & Fund
              </button>
            )}
            {drawInDetail.ai_status === 'fail' && (
              <button
                onClick={() => handleReturn(drawInDetail)}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
              >
                Return to Borrower
              </button>
            )}
          </div>
        </div>

        {drawInDetail.ai_status && (
          <div className={`rounded-xl p-4 ${aiStatusBadge(drawInDetail.ai_status)}`}>
            <p className="text-sm font-semibold">
              AI Review:{' '}
              {drawInDetail.ai_status === 'pass' ? 'Package complete — approved for funding' :
               drawInDetail.ai_status === 'fail' ? 'Exceptions found — disbursement on hold' :
               'In review'}
            </p>
            {drawInDetail.ai_issues.length > 0 && (
              <ul className="mt-2 space-y-1">
                {drawInDetail.ai_issues.map((issue) => (
                  <li key={issue.code} className="flex items-start gap-2">
                    <span className={`mt-0.5 rounded px-1.5 py-0.5 text-xs font-bold ${severityColor(issue.severity)}`}>
                      {issue.severity.toUpperCase()}
                    </span>
                    <span className="text-xs">{issue.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Invoices</h3>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase text-slate-400">
                  <th className="pb-2 text-left">Vendor</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-right">Date</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drawInDetail.invoices.map((inv, i) => (
                  <tr key={i}>
                    <td className="py-2 font-medium text-slate-900">{inv.vendor}</td>
                    <td className="py-2 text-right text-slate-700">{fmt(inv.amount)}</td>
                    <td className="py-2 text-right text-slate-500">{inv.date}</td>
                    <td className="py-2 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${inv.approved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {inv.approved ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Lien waivers</h3>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase text-slate-400">
                  <th className="pb-2 text-left">Vendor</th>
                  <th className="pb-2 text-right">Type</th>
                  <th className="pb-2 text-right">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drawInDetail.lien_waivers.map((lw, i) => (
                  <tr key={i}>
                    <td className="py-2 font-medium text-slate-900">{lw.vendor}</td>
                    <td className="py-2 text-right capitalize text-slate-700">{lw.type}</td>
                    <td className="py-2 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lw.received ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'}`}>
                        {lw.received ? 'Yes' : 'Missing'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            SOV vs inspector — line item reconciliation
          </h3>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold uppercase text-slate-400">
                <th className="pb-2 text-left">Work item</th>
                <th className="pb-2 text-right">Amount</th>
                <th className="pb-2 text-right">SOV %</th>
                <th className="pb-2 text-right">Inspector %</th>
                <th className="pb-2 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {drawInDetail.line_items.map((li, i) => {
                const variance = Math.abs(li.sov_pct - li.inspector_pct);
                return (
                  <tr key={i}>
                    <td className="py-2 font-medium text-slate-900">{li.description}</td>
                    <td className="py-2 text-right text-slate-700">{fmt(li.amount)}</td>
                    <td className="py-2 text-right text-slate-700">{li.sov_pct}%</td>
                    <td className="py-2 text-right text-slate-700">{li.inspector_pct}%</td>
                    <td className={`py-2 text-right font-semibold ${variance > 2 ? 'text-brand-600' : 'text-emerald-600'}`}>
                      {variance > 0 ? `${variance}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <span className={`h-2.5 w-2.5 rounded-full ${drawInDetail.inspector_cert ? 'bg-emerald-500' : 'bg-brand-500'}`} />
            <span className="text-xs font-medium text-slate-700">
              Inspector certification: {drawInDetail.inspector_cert ? 'Received' : 'NOT received'}
            </span>
          </div>
        </section>

        {narrative && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                AI-generated servicing narrative
              </h3>
              <button
                onClick={() => setNarrative(null)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Dismiss
              </button>
            </div>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
              {narrative}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}
