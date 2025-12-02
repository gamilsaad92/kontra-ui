import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import VirtualAssistant from '../components/VirtualAssistant';

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      </div>
      {children}
    </section>
  );
}

async function askAssistant(question) {
  const res = await fetch(`${API_BASE}/api/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Assistant unavailable');
  }
  return res.json();
}

function extractContent(payload) {
  if (!payload) return null;
  if (payload.functionResult) return payload.functionResult;
  const content = payload.assistant?.content;
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch (_err) {
    return { text: content };
  }
}

export default function BorrowerPortal() {
  const [payoff, setPayoff] = useState({ loading: true });
  const [revived, setRevived] = useState({ loading: true });
  const [escrowLoanId, setEscrowLoanId] = useState('');
  const [escrow, setEscrow] = useState({ loading: false });

  useEffect(() => {
    askAssistant('Share the payoff instructions for my loan, formatted for borrowers.')
      .then(data => setPayoff({ loading: false, data: extractContent(data) }))
      .catch(err => setPayoff({ loading: false, error: err.message }));

    askAssistant('List revived assets and any recent recovery insights.')
      .then(data => setRevived({ loading: false, data: extractContent(data) }))
      .catch(err => setRevived({ loading: false, error: err.message }));
  }, []);

  const loadEscrow = async () => {
    if (!escrowLoanId.trim()) return;
    setEscrow({ loading: true });
    try {
      const data = await askAssistant(`Provide the escrow balance for loan ${escrowLoanId}. If possible return JSON.`);
      setEscrow({ loading: false, data: extractContent(data) });
    } catch (err) {
      setEscrow({ loading: false, error: err.message });
    }
  };

  return (
    <div className="space-y-4 bg-slate-100 p-4">
      <h1 className="text-2xl font-semibold text-slate-900">Borrower Self-Service</h1>
      <p className="text-sm text-slate-600">
        Answers are fetched from the AI assistant and its callable functions so borrowers can self-serve balances, payoff details,
        and asset recovery highlights.
      </p>

      <Section title="Payoff Instructions">
        {payoff.loading && <p className="text-sm text-slate-500">Loading payoff steps…</p>}
        {payoff.error && <p className="text-sm text-rose-600">{payoff.error}</p>}
        {payoff.data?.instructions && (
          <pre className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-sm text-slate-800">{payoff.data.instructions}</pre>
        )}
        {payoff.data?.text && <p className="text-sm text-slate-800">{payoff.data.text}</p>}
      </Section>

      <Section title="Escrow Balances">
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            className="flex-1 rounded border border-slate-200 p-2"
            placeholder="Enter your loan ID"
            value={escrowLoanId}
            onChange={e => setEscrowLoanId(e.target.value)}
          />
          <button
            className="rounded bg-sky-600 px-3 py-2 text-white"
            onClick={loadEscrow}
            disabled={escrow.loading}
          >
            {escrow.loading ? 'Fetching…' : 'Get Balance'}
          </button>
        </div>
        {escrow.loading && <p className="text-sm text-slate-500">Checking escrow…</p>}
        {escrow.error && <p className="text-sm text-rose-600">{escrow.error}</p>}
        {escrow.data && (
          <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
            <p><span className="font-semibold">Balance:</span> {escrow.data.escrow_balance ?? escrow.data.balance ?? 'N/A'}</p>
            {escrow.data.insurance_amount && (
              <p><span className="font-semibold">Insurance:</span> {escrow.data.insurance_amount}</p>
            )}
            {escrow.data.loan_id && (
              <p className="text-xs text-slate-500">Loan ID: {escrow.data.loan_id}</p>
            )}
          </div>
        )}
      </Section>

      <Section title="Revived Assets">
        {revived.loading && <p className="text-sm text-slate-500">Loading revived assets…</p>}
        {revived.error && <p className="text-sm text-rose-600">{revived.error}</p>}
        {Array.isArray(revived.data?.data) && revived.data.data.length > 0 && (
          <ul className="divide-y divide-slate-200 text-sm">
            {revived.data.data.map(asset => (
              <li key={asset.id || asset.asset_id} className="py-2">
                <div className="font-semibold text-slate-800">{asset.name || asset.id || asset.asset_id}</div>
                <div className="text-slate-600">{asset.status || 'Revived'}</div>
                {asset.updated_at && <div className="text-xs text-slate-500">Updated {asset.updated_at}</div>}
              </li>
            ))}
          </ul>
        )}
        {revived.data?.text && <p className="text-sm text-slate-800">{revived.data.text}</p>}
      </Section>

      <Section title="Chat with the Assistant">
        <div className="h-80">
          <VirtualAssistant placeholder="Ask about payoff or escrow…" />
        </div>
      </Section>
    </div>
  );
}
