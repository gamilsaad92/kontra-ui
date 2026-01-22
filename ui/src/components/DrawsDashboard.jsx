import React, { useState } from 'react';
import InsightsCard from './InsightsCard';
import DrawRequestForm from './DrawRequestForm';
import DrawRequestsTable from './DrawRequestsTable';
import LienWaiverForm from './LienWaiverForm';
import LienWaiverList from './LienWaiverList';
import TokenizedDrawNotes from './draws/TokenizedDrawNotes';
import EscrowCommercialPaperPanel from './draws/EscrowCommercialPaperPanel';
import SyndicationWorkflow from './draws/SyndicationWorkflow';

export default function DrawsDashboard() {
  const [selected, setSelected] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [loanId, setLoanId] = useState('');
  
  return (
    <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Draws Insights</h2>
        <p className="text-xs text-slate-500">
          Link a loan to surface servicing insights alongside draw workflows.
        </p>
        <input
          className="mt-3 w-full rounded border border-slate-200 p-2 text-sm"
          placeholder="Loan ID"
          value={loanId}
          onChange={(event) => setLoanId(event.target.value)}
        />
        <div className="mt-4">
          <InsightsCard loanId={loanId} title="Draws Insights" />
        </div>
      </div>
      <TokenizedDrawNotes />
      <EscrowCommercialPaperPanel />
      <SyndicationWorkflow />
      <DrawRequestForm onSubmitted={id => setSelected(id)} />
      {selected && (
        <>
          <LienWaiverForm drawId={selected} onUploaded={() => setRefresh(r => r + 1)} />
          <LienWaiverList filter={{ draw_id: selected, refresh }} />
        </>
      )}
      <DrawRequestsTable onSelect={id => setSelected(id)} canReview />
    </div>
  );
}
