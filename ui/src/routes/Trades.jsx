import React, { useEffect, useState } from 'react';
import TradeList from '../components/trades/TradeList';
import TradeForm from '../components/trades/TradeForm';

export default function Trades() {
  const [trades, setTrades] = useState([]);

  const fetchTrades = async () => {
    const res = await fetch('/api/trades');
    const data = await res.json();
    setTrades(data);
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  const openTrades = trades.filter(t => t.status === 'open');
  const completedTrades = trades.filter(t => t.status === 'completed');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Trades</h1>
      <TradeForm onSubmitted={fetchTrades} />
      <TradeList trades={openTrades} title="Open Trades" />
      <TradeList trades={completedTrades} title="Completed Trades" />
    </div>
  );
}
