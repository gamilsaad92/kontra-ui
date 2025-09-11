import React, { useState } from 'react';

export default function TradeForm({ onSubmitted }) {
  const [tradeType, setTradeType] = useState('loan_sale');
  const [notionalAmount, setNotionalAmount] = useState('');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [side, setSide] = useState('buy');
  const [counterparties, setCounterparties] = useState('');
  const [repoRate, setRepoRate] = useState('');
  const [termDays, setTermDays] = useState('');
  const [collateralRef, setCollateralRef] = useState('');
  const [distributionSchedule, setDistributionSchedule] = useState('');
  const [agentBank, setAgentBank] = useState('');
  
  const handleSubmit = async e => {
    e.preventDefault();
    await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trade_type: tradeType,
       notional_amount: Number(notionalAmount),
        symbol,
        quantity: Number(quantity),
        price: Number(price),
        side,
        counterparties: counterparties
          .split(',')
          .map(c => c.trim())
           .filter(Boolean),
        repo_rate_bps: repoRate ? Number(repoRate) : undefined,
        term_days: termDays ? Number(termDays) : undefined,
        collateral_ref: collateralRef || undefined,
        distribution_schedule: distributionSchedule || undefined,
        agent_bank: agentBank || undefined
      })
    });
    setTradeType('loan_sale');
    setNotionalAmount('');
    setSymbol('');
    setQuantity('');
    setPrice('');
    setSide('buy');
    setCounterparties('');
    setRepoRate('');
    setTermDays('');
    setCollateralRef('');
    setDistributionSchedule('');
    setAgentBank('');
    onSubmitted && onSubmitted();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 mb-6">
            <select
        aria-label="Trade Type"
        value={tradeType}
        onChange={e => setTradeType(e.target.value)}
        className="border p-2 rounded w-full"
      >
        <option value="loan_sale">Loan Sale</option>
        <option value="participation">Participation</option>
        <option value="syndication_assignment">Syndication</option>
        <option value="repo">Repo</option>
      </select>
      <input
        value={notionalAmount}
        onChange={e => setNotionalAmount(e.target.value)}
        placeholder="Notional Amount"
        aria-label="Notional Amount"
        className="border p-2 rounded w-full"
      />
      <input
        value={symbol}
        onChange={e => setSymbol(e.target.value)}
        placeholder="Symbol"
        className="border p-2 rounded w-full"
      />
      <input
        value={quantity}
        onChange={e => setQuantity(e.target.value)}
        placeholder="Quantity"
        className="border p-2 rounded w-full"
      />
        <input
        value={price}
        onChange={e => setPrice(e.target.value)}
        placeholder="Price"
        className="border p-2 rounded w-full"
      />
            {tradeType === 'repo' && (
        <>
          <input
            value={repoRate}
            onChange={e => setRepoRate(e.target.value)}
            placeholder="Repo Rate (bps)"
            className="border p-2 rounded w-full"
          />
          <input
            value={termDays}
            onChange={e => setTermDays(e.target.value)}
            placeholder="Term (days)"
            className="border p-2 rounded w-full"
          />
          <input
            value={collateralRef}
            onChange={e => setCollateralRef(e.target.value)}
            placeholder="Collateral Ref"
            className="border p-2 rounded w-full"
          />
        </>
      )}
      {tradeType === 'participation' && (
        <input
          value={distributionSchedule}
          onChange={e => setDistributionSchedule(e.target.value)}
          placeholder="Distribution Schedule"
          className="border p-2 rounded w-full"
        />
      )}
      {tradeType === 'syndication_assignment' && (
        <input
          value={agentBank}
          onChange={e => setAgentBank(e.target.value)}
          placeholder="Agent Bank"
          className="border p-2 rounded w-full"
        />
      )}
      <select
        value={side}
        onChange={e => setSide(e.target.value)}
        className="border p-2 rounded w-full"
      >
        <option value="buy">Buy</option>
        <option value="sell">Sell</option>
      </select>
      <input
        value={counterparties}
        onChange={e => setCounterparties(e.target.value)}
        placeholder="Counterparties (comma separated)"
        className="border p-2 rounded w-full"
      />
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        Submit Trade
      </button>
    </form>
  );
}
