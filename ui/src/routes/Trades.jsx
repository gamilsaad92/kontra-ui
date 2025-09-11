import React, { useEffect, useState } from 'react';
import TradeList from '../components/trades/TradeList';
import TradeForm from '../components/trades/TradeForm';
import Marketplace from '../components/trades/Marketplace';

export default function Trades() {
  const [trades, setTrades] = useState([]);
  const [marketEntries, setMarketEntries] = useState([]);
  const [toast, setToast] = useState(null);
  
  const fetchTrades = async () => {
    const res = await fetch('/api/trades');
    const data = await res.json();
    setTrades(data.trades || []);
  };
  const fetchMarketplace = async () => {
    const res = await fetch('/api/marketplace');
    const data = await res.json();
    setMarketEntries(data.entries || []);
  };
  
  useEffect(() => {
    fetchTrades();
    fetchMarketplace();
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/collab`);
    ws.onmessage = evt => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'trade.created' || msg.type === 'trade.settled') {
          setToast(msg.type === 'trade.created' ? 'Trade created' : 'Trade settled');
          fetchTrades();
          setTimeout(() => setToast(null), 3000);
        }
      } catch {
        // ignore malformed messages
      }
    };
    return () => ws.close();
  }, []);

  const settleTrade = async id => {
    const res = await fetch(`/api/trades/${id}/settle`, { method: 'POST' });
    if (res.ok) {
      setToast('Trade settled');
      fetchTrades();
    } else {
      setToast('Failed to settle trade');
    }
    setTimeout(() => setToast(null), 3000);
  };

  const openTrades = trades.filter(t => t.status === 'pending');
  const completedTrades = trades.filter(t => t.status === 'settled');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Trades</h1>
      {toast && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded">
          {toast}
        </div>
      )}
      <TradeForm onSubmitted={fetchTrades} />
      <TradeForm onSubmitted={() => { fetchTrades(); fetchMarketplace(); }} />
      <Marketplace entries={marketEntries} onSubmitted={fetchMarketplace} />
      <TradeList trades={completedTrades} title="Settled Trades" />
    </div>
  );
}
