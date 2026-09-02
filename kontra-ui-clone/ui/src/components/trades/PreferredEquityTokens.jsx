import React, { useState } from 'react';
import { apiFetch } from '../../lib/apiClient'

function DistributionForm({ tokenId, onSubmitted, onNotify }) {
  const [distributionDate, setDistributionDate] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
   await apiFetch(`/api/exchange-programs/preferred-equity/${tokenId}/distributions`, {
     method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        distribution_date: distributionDate,
        amount: Number(amount),
        memo: memo || undefined
      })
    });
    setDistributionDate('');
    setAmount('');
    setMemo('');
    onNotify?.('Distribution recorded');
    onSubmitted?.();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-2 md:grid-cols-4">
      <input
        type="date"
        value={distributionDate}
        onChange={e => setDistributionDate(e.target.value)}
        className="border p-2 rounded"
        aria-label="Distribution Date"
      />
      <input
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="Amount"
        className="border p-2 rounded"
      />
      <input
        value={memo}
        onChange={e => setMemo(e.target.value)}
        placeholder="Memo"
        className="border p-2 rounded"
      />
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        Schedule Distribution
      </button>
    </form>
  );
}

export default function PreferredEquityTokens({ tokens = [], onRefresh, onNotify }) {
  const [tokenName, setTokenName] = useState('');
  const [project, setProject] = useState('');
  const [pricePerToken, setPricePerToken] = useState('');
  const [totalSupply, setTotalSupply] = useState('');
  const [targetIrr, setTargetIrr] = useState('');
  const [distributionFrequency, setDistributionFrequency] = useState('Quarterly');
  const [waterfallNotes, setWaterfallNotes] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    await apiFetch('/api/exchange-programs/preferred-equity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_name: tokenName,
        project,
        price_per_token: Number(pricePerToken),
        total_supply: Number(totalSupply),
        target_irr: targetIrr ? Number(targetIrr) : undefined,
        distribution_frequency: distributionFrequency,
        waterfall_notes: waterfallNotes || undefined
      })
    });
    setTokenName('');
    setProject('');
    setPricePerToken('');
    setTotalSupply('');
    setTargetIrr('');
    setDistributionFrequency('Quarterly');
    setWaterfallNotes('');
    onNotify?.('Preferred equity token issued');
    onRefresh?.();
  };

  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Preferred Equity Tokenization</h2>
        <p className="text-sm text-gray-600">
          Tokenize preferred equity interests with cash-flow distribution logic embedded in Kontra.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <input
          value={tokenName}
          onChange={e => setTokenName(e.target.value)}
          placeholder="Token Name"
          className="border p-2 rounded"
          aria-label="Token Name"
        />
        <input
          value={project}
          onChange={e => setProject(e.target.value)}
          placeholder="Project"
          className="border p-2 rounded"
        />
        <input
          value={pricePerToken}
          onChange={e => setPricePerToken(e.target.value)}
          placeholder="Price per Token"
          className="border p-2 rounded"
          aria-label="Price per Token"
        />
        <input
          value={totalSupply}
          onChange={e => setTotalSupply(e.target.value)}
          placeholder="Total Supply"
          className="border p-2 rounded"
          aria-label="Total Supply"
        />
        <input
          value={targetIrr}
          onChange={e => setTargetIrr(e.target.value)}
          placeholder="Target IRR (%)"
          className="border p-2 rounded"
        />
        <select
          value={distributionFrequency}
          onChange={e => setDistributionFrequency(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="Monthly">Monthly</option>
          <option value="Quarterly">Quarterly</option>
          <option value="Semi-Annual">Semi-Annual</option>
          <option value="Annual">Annual</option>
        </select>
        <textarea
          value={waterfallNotes}
          onChange={e => setWaterfallNotes(e.target.value)}
          placeholder="Payout notes (preferred return, catch-up, etc.)"
          className="border p-2 rounded md:col-span-2 lg:col-span-3"
          rows={2}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded md:col-span-2 lg:col-span-3"
        >
          Issue Preferred Equity
        </button>
      </form>
      {tokens.length === 0 ? (
        <p className="text-gray-500">No preferred equity programs issued.</p>
      ) : (
        <div className="space-y-4">
          {tokens.map(token => (
            <div key={token.id} className="border rounded p-4 bg-white shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{token.token_name}</h3>
                  <p className="text-sm text-gray-600">
                    Project: {token.project || 'N/A'} · Price: $
                    {Number(token.price_per_token || 0).toLocaleString()} · Supply:{' '}
                    {Number(token.total_supply || 0).toLocaleString()} · Target IRR:{' '}
                    {token.target_irr ? `${token.target_irr}%` : 'N/A'}
                  </p>
                  {token.waterfall_notes ? (
                    <p className="text-sm text-gray-600 mt-2">{token.waterfall_notes}</p>
                  ) : null}
                </div>
                <div className="flex-1 md:text-right">
                  <p className="text-sm font-semibold">Distribution Schedule ({token.distribution_frequency || 'Flexible'})</p>
                  {token.distributions?.length ? (
                    <ul className="text-sm text-gray-700 mt-2 space-y-1">
                      {token.distributions.map(distribution => (
                        <li key={distribution.id}>
                          {distribution.distribution_date} · $
                          {Number(distribution.amount || 0).toLocaleString()}
                          {distribution.memo ? ` · ${distribution.memo}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No distributions recorded</p>
                  )}
                </div>
              </div>
              <DistributionForm tokenId={token.id} onSubmitted={onRefresh} onNotify={onNotify} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
