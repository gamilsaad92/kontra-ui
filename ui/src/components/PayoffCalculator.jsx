import React, { useState } from 'react';

export default function PayoffCalculator() {
  const [principal, setPrincipal] = useState('');
  const [noteRate, setNoteRate] = useState('');
  const [monthsRemaining, setMonthsRemaining] = useState('');
  const [treasuryRate, setTreasuryRate] = useState('');
  const [cmtRate, setCmtRate] = useState('');
  const [results, setResults] = useState(null);

  const calcPenalty = (refRate) => {
    const p = parseFloat(principal);
    const note = parseFloat(noteRate) / 100;
    const term = parseInt(monthsRemaining, 10);
    const ref = parseFloat(refRate) / 100;

    if (!p || !note || !term || (!ref && ref !== 0)) return 0;

    const monthlyNote = note / 12;
    const monthlyRef = ref / 12;
    const pvFactor = monthlyRef === 0
      ? term
      : (1 - Math.pow(1 + monthlyRef, -term)) / monthlyRef;
    const penalty = p * Math.max(0, (monthlyNote - monthlyRef) * pvFactor);
    return penalty;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setResults({
      yieldMaintenance: calcPenalty(treasuryRate),
      yieldMaintenanceCMT: calcPenalty(cmtRate)
    });
  };

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">Prepayment Calculator</h2>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="number"
          className="input w-full"
          placeholder="Outstanding Principal"
          value={principal}
          onChange={e => setPrincipal(e.target.value)}
          step="0.01"
        />
        <input
          type="number"
          className="input w-full"
          placeholder="Note Rate (%)"
          value={noteRate}
          onChange={e => setNoteRate(e.target.value)}
          step="0.01"
        />
        <input
          type="number"
          className="input w-full"
          placeholder="Months Remaining"
          value={monthsRemaining}
          onChange={e => setMonthsRemaining(e.target.value)}
        />
        <input
          type="number"
          className="input w-full"
          placeholder="Treasury Yield (%)"
          value={treasuryRate}
          onChange={e => setTreasuryRate(e.target.value)}
          step="0.01"
        />
        <input
          type="number"
          className="input w-full"
          placeholder="CMT Yield (%)"
          value={cmtRate}
          onChange={e => setCmtRate(e.target.value)}
          step="0.01"
        />
        <button type="submit" className="btn btn-primary w-full mt-2">
          Calculate
        </button>
      </form>
      {results && (
        <div className="mt-4 space-y-1">
          <p>Yield Maintenance: ${results.yieldMaintenance.toFixed(2)}</p>
          <p>Yield Maintenance CMT: ${results.yieldMaintenanceCMT.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}
