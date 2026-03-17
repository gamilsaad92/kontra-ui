import { useState } from 'react';

type WorkflowStatus = 'queued' | 'running' | 'needs_review' | 'completed' | 'failed' | 'cancelled';
type WorkflowType =
  | 'financial_review'
  | 'inspection_review'
  | 'draw_review'
  | 'borrower_communication'
  | 'risk_scoring'
  | 'covenant_breach';

type StepResult = {
  status: 'pass' | 'fail' | 'needs_review';
  confidence: number;
  title: string;
  summary: string;
  reasons: { code: string; severity: string; message: string }[];
};

type Artifact = {
  id: string;
  artifact_type: string;
  content: Record<string, unknown>;
};

type WorkflowRun = {
  id: string;
  workflow_type: WorkflowType;
  status: WorkflowStatus;
  loan_id: string | null;
  property_name: string;
  priority: number;
  created_at: string;
  steps: { step: string; agent: string; result: StepResult }[];
  artifacts: Artifact[];
  human_review?: { review_status: string; review_notes: string };
};

const DEMO_RUNS: WorkflowRun[] = [
  {
    id: 'wf-001',
    workflow_type: 'financial_review',
    status: 'needs_review',
    loan_id: 'loan-maple-ridge',
    property_name: 'Maple Ridge Apartments',
    priority: 1,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    steps: [
      {
        step: 'analyze_financials',
        agent: 'financial',
        result: {
          status: 'fail',
          confidence: 0.82,
          title: 'Maple Ridge — Q1 2026: DSCR covenant breach — DSCR 1.08x below 1.20 covenant',
          summary: 'DSCR: 1.08x (covenant: 1.20x) | Occupancy: 87.0% | NOI: $1,840,000 vs UW $2,100,000. 2 exception(s) require review.',
          reasons: [
            { code: 'dscr_below_covenant', severity: 'high', message: 'DSCR of 1.08x is below the loan covenant of 1.20x.' },
            { code: 'noi_below_underwritten', severity: 'medium', message: 'NOI of $1,840,000 is 12.4% below underwritten $2,100,000.' },
          ],
        },
      },
      {
        step: 'update_risk_score',
        agent: 'risk',
        result: {
          status: 'fail',
          confidence: 0.79,
          title: 'Maple Ridge — Risk Score: 55/100 — Watchlist',
          summary: 'Composite risk score of 55/100. Classification: watchlist. Add to watchlist. Increase reporting frequency.',
          reasons: [
            { code: 'risk_financial', severity: 'high', message: 'DSCR at 1.08x is below covenant level.' },
            { code: 'risk_noi', severity: 'medium', message: 'NOI 12.4% below underwritten levels.' },
          ],
        },
      },
      {
        step: 'draft_if_exceptions',
        agent: 'borrower_comm',
        result: {
          status: 'needs_review',
          confidence: 0.78,
          title: 'Maple Ridge — cure notice draft ready for review',
          summary: 'Cure notice prepared for Northbrook Capital LLC. Requires servicer review before sending.',
          reasons: [],
        },
      },
    ],
    artifacts: [
      { id: 'art-1', artifact_type: 'email_draft', content: { draft_subject: 'Cure Notice — Covenant Exception — Maple Ridge Apartments', draft_body: 'Dear Northbrook Capital LLC,\n\nRe: Maple Ridge — Cure Notice...' } },
      { id: 'art-2', artifact_type: 'watchlist_comment', content: { classification: 'watchlist', risk_score: 55 } },
    ],
    human_review: undefined,
  },
  {
    id: 'wf-002',
    workflow_type: 'draw_review',
    status: 'needs_review',
    loan_id: 'loan-riverside',
    property_name: 'Riverside Commons',
    priority: 3,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    steps: [
      {
        step: 'validate_draw_package',
        agent: 'draw',
        result: {
          status: 'fail',
          confidence: 0.91,
          title: 'Riverside Commons — Draw #3: package exceptions — disbursement on hold',
          summary: 'Missing conditional lien waiver for GHI Plumbing ($50,000). SOV variance 3% on plumbing.',
          reasons: [
            { code: 'LIEN_WAIVER_MISSING', severity: 'high', message: 'Missing conditional lien waiver for GHI Plumbing ($50,000).' },
            { code: 'SOV_INSPECTOR_VARIANCE', severity: 'medium', message: 'Plumbing SOV 15% vs inspector 12% — 3% variance.' },
          ],
        },
      },
    ],
    artifacts: [
      { id: 'art-3', artifact_type: 'email_draft', content: { draft_subject: 'Deficiency Notice — Draw #3 — Riverside Commons', draft_body: 'Dear Borrower...' } },
    ],
    human_review: undefined,
  },
  {
    id: 'wf-003',
    workflow_type: 'inspection_review',
    status: 'completed',
    loan_id: 'loan-oak-view',
    property_name: 'Oak View Terrace',
    priority: 5,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    steps: [
      {
        step: 'analyze_inspection',
        agent: 'inspection',
        result: {
          status: 'pass',
          confidence: 0.94,
          title: 'Oak View Terrace — inspection review: no material exceptions',
          summary: 'All required photos received. No life-safety items. Minor scope items within tolerance.',
          reasons: [],
        },
      },
    ],
    artifacts: [],
    human_review: { review_status: 'approved', review_notes: 'Inspection package complete. No action required.' },
  },
  {
    id: 'wf-004',
    workflow_type: 'risk_scoring',
    status: 'queued',
    loan_id: 'loan-summit',
    property_name: 'Summit Place Portfolio',
    priority: 2,
    created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    steps: [],
    artifacts: [],
    human_review: undefined,
  },
];

const statusConfig: Record<WorkflowStatus, { label: string; class: string }> = {
  queued: { label: 'Queued', class: 'bg-slate-100 text-slate-600' },
  running: { label: 'Running', class: 'bg-blue-100 text-blue-700' },
  needs_review: { label: 'Needs Review', class: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', class: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Failed', class: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Cancelled', class: 'bg-slate-100 text-slate-400' },
};

const workflowLabel: Record<WorkflowType, string> = {
  financial_review: 'Financial Review',
  inspection_review: 'Inspection Review',
  draw_review: 'Draw Review',
  borrower_communication: 'Borrower Comm',
  risk_scoring: 'Risk Scoring',
  covenant_breach: 'Covenant Breach',
};

const severityColor = (s: string) => {
  if (s === 'high') return 'text-rose-700 bg-rose-50 border-rose-100';
  if (s === 'medium') return 'text-amber-700 bg-amber-50 border-amber-100';
  return 'text-slate-600 bg-slate-50 border-slate-100';
};

const aiResultBadge = (s: string) => {
  if (s === 'pass') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (s === 'fail') return 'bg-rose-50 text-rose-700 border border-rose-200';
  return 'bg-amber-50 text-amber-700 border border-amber-200';
};

const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

type TabFilter = 'all' | WorkflowStatus;

export default function ServicingAIOpsPage() {
  const [runs] = useState<WorkflowRun[]>(DEMO_RUNS);
  const [selected, setSelected] = useState<WorkflowRun | null>(runs[0]);
  const [tab, setTab] = useState<TabFilter>('all');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState<Record<string, string>>({});

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'all', label: `All (${runs.length})` },
    { key: 'needs_review', label: `Needs Review (${runs.filter((r) => r.status === 'needs_review').length})` },
    { key: 'queued', label: 'Queued' },
    { key: 'running', label: 'Running' },
    { key: 'completed', label: 'Completed' },
    { key: 'failed', label: 'Failed' },
  ];

  const filtered = tab === 'all' ? runs : runs.filter((r) => r.status === tab);

  const handleApprove = (run: WorkflowRun) => {
    setReviewSubmitted((prev) => ({ ...prev, [run.id]: 'approved' }));
  };

  const handleReject = (run: WorkflowRun) => {
    setReviewSubmitted((prev) => ({ ...prev, [run.id]: 'rejected' }));
  };

  const handleRequestChanges = (run: WorkflowRun) => {
    setReviewSubmitted((prev) => ({ ...prev, [run.id]: 'changes_requested' }));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">AI Operations</h2>
          <p className="mt-1 text-sm text-slate-500">
            Automated servicing workflow runs — financial, draw, inspection, risk, and borrower comms.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            {runs.filter((r) => r.status === 'needs_review').length} awaiting review
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            {runs.filter((r) => r.status === 'queued' || r.status === 'running').length} active
          </span>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-t px-3 py-1.5 text-xs font-semibold transition ${
              tab === t.key ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-2">
          {filtered.map((run) => (
            <button
              key={run.id}
              onClick={() => { setSelected(run); setReviewNotes(''); }}
              className={`w-full rounded-xl border p-3 text-left transition ${
                selected?.id === run.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <p className={`truncate text-sm font-semibold ${selected?.id === run.id ? 'text-white' : 'text-slate-900'}`}>
                  {run.property_name}
                </p>
                <span className={`flex-none rounded-full px-2 py-0.5 text-xs font-semibold ${statusConfig[run.status].class}`}>
                  {statusConfig[run.status].label}
                </span>
              </div>
              <p className={`mt-1 text-xs ${selected?.id === run.id ? 'text-slate-300' : 'text-slate-500'}`}>
                {workflowLabel[run.workflow_type] ?? run.workflow_type} · {timeAgo(run.created_at)}
              </p>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
              No workflow runs in this category.
            </p>
          )}
        </aside>

        {selected && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{selected.property_name}</h3>
                <p className="text-sm text-slate-500">
                  {workflowLabel[selected.workflow_type]} ·{' '}
                  Priority {selected.priority} · {timeAgo(selected.created_at)}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusConfig[selected.status].class}`}>
                {statusConfig[selected.status].label}
              </span>
            </div>

            {/* Agent steps */}
            {selected.steps.length > 0 && (
              <section className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agent steps</h4>
                {selected.steps.map((step, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold uppercase text-slate-400">{step.agent}</span>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900">{step.step.replace(/_/g, ' ')}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${aiResultBadge(step.result.status)}`}>
                        {step.result.status.replace('_', ' ')} · {Math.round(step.result.confidence * 100)}%
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{step.result.summary}</p>
                    {step.result.reasons.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {step.result.reasons.map((r) => (
                          <li key={r.code} className={`flex items-start gap-2 rounded border p-2 text-xs ${severityColor(r.severity)}`}>
                            <span className="font-bold uppercase">{r.severity}</span>
                            <span>{r.message}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </section>
            )}

            {selected.steps.length === 0 && selected.status === 'queued' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm font-medium text-slate-600">Workflow queued — execution pending</p>
                <p className="mt-1 text-xs text-slate-400">The AI agent will begin processing shortly.</p>
              </div>
            )}

            {/* Artifacts */}
            {selected.artifacts.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Artifacts</h4>
                <div className="mt-3 space-y-3">
                  {selected.artifacts.map((art) => (
                    <div key={art.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        {art.artifact_type.replace(/_/g, ' ')}
                      </p>
                      {art.artifact_type === 'email_draft' && (
                        <>
                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {String(art.content.draft_subject ?? '')}
                          </p>
                          <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-slate-600 leading-relaxed">
                            {String(art.content.draft_body ?? '')}
                          </pre>
                        </>
                      )}
                      {art.artifact_type !== 'email_draft' && (
                        <pre className="mt-1 text-xs text-slate-600 overflow-auto max-h-24">
                          {JSON.stringify(art.content, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Human review panel */}
            {selected.status === 'needs_review' && !reviewSubmitted[selected.id] && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <h4 className="text-sm font-semibold text-amber-800">Human review required</h4>
                <p className="mt-1 text-xs text-amber-700">
                  Review the agent output above. No action will be taken without your explicit approval.
                </p>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add review notes (optional)…"
                  className="mt-3 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  rows={3}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleApprove(selected)}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Approve output
                  </button>
                  <button
                    onClick={() => handleRequestChanges(selected)}
                    className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-50"
                  >
                    Request changes
                  </button>
                  <button
                    onClick={() => handleReject(selected)}
                    className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50"
                  >
                    Reject
                  </button>
                </div>
              </section>
            )}

            {reviewSubmitted[selected.id] && (
              <section className={`rounded-xl border p-4 ${
                reviewSubmitted[selected.id] === 'approved' ? 'border-emerald-200 bg-emerald-50'
                : reviewSubmitted[selected.id] === 'rejected' ? 'border-rose-200 bg-rose-50'
                : 'border-amber-200 bg-amber-50'
              }`}>
                <p className={`text-sm font-semibold ${
                  reviewSubmitted[selected.id] === 'approved' ? 'text-emerald-800'
                  : reviewSubmitted[selected.id] === 'rejected' ? 'text-rose-800'
                  : 'text-amber-800'
                }`}>
                  Review submitted: {reviewSubmitted[selected.id].replace('_', ' ')}
                  {reviewNotes && ` — "${reviewNotes}"`}
                </p>
                <p className="mt-1 text-xs text-slate-500">Logged to audit trail. Workflow updated.</p>
              </section>
            )}

            {selected.human_review && (
              <section className={`rounded-xl border p-4 ${
                selected.human_review.review_status === 'approved' ? 'border-emerald-200 bg-emerald-50'
                : 'border-slate-200 bg-slate-50'
              }`}>
                <p className="text-sm font-semibold text-slate-700">
                  Review: {selected.human_review.review_status.replace('_', ' ')}
                </p>
                {selected.human_review.review_notes && (
                  <p className="mt-1 text-xs text-slate-500">{selected.human_review.review_notes}</p>
                )}
              </section>
            )}

            {/* Audit trail */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audit trail</h4>
              <div className="mt-3 space-y-2">
                <div className="text-xs text-slate-500 border-b border-slate-100 pb-2">
                  <span className="font-semibold text-slate-700">Workflow created</span> · {new Date(selected.created_at).toLocaleString()} · status: queued
                </div>
                {selected.steps.map((step, i) => (
                  <div key={i} className="text-xs text-slate-500 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <span className="font-semibold text-slate-700">{step.agent} agent</span> ran step "{step.step.replace(/_/g, ' ')}" ·{' '}
                    result: <span className={step.result.status === 'pass' ? 'text-emerald-600' : step.result.status === 'fail' ? 'text-rose-600' : 'text-amber-600'}>{step.result.status}</span>{' '}
                    · confidence: {Math.round(step.result.confidence * 100)}%
                  </div>
                ))}
                {reviewSubmitted[selected.id] && (
                  <div className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">Human review</span> submitted ·{' '}
                    decision: {reviewSubmitted[selected.id].replace('_', ' ')}
                    {reviewNotes && ` · notes: "${reviewNotes}"`}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
