import React, { useState } from 'react';
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

  return (
    <div className="space-y-6">
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
