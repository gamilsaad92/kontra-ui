import React, { useEffect, useState } from 'react';
import TradeList from '../components/trades/TradeList';
import TradeForm from '../components/trades/TradeForm';
import Marketplace from '../components/trades/Marketplace';
import MiniCmbsPools from '../components/trades/MiniCmbsPools';
import ParticipationMarketplace from '../components/trades/ParticipationMarketplace';
import PreferredEquityTokens from '../components/trades/PreferredEquityTokens';

export default function Trades() {
  const [trades, setTrades] = useState([]);
  const [marketEntries, setMarketEntries] = useState([]);
  const [cmbsPools, setCmbsPools] = useState([]);
  const [participations, setParticipations] = useState([]);
  const [preferredEquity, setPreferredEquity] = useState([]);
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
   const fetchMiniCmbs = async () => {
    const res = await fetch('/api/exchange-programs/mini-cmbs');
    if (!res.ok) return;
    const data = await res.json();
    setCmbsPools(data.pools || []);
  };
  const fetchParticipations = async () => {
    const res = await fetch('/api/exchange-programs/participations');
    if (!res.ok) return;
    const data = await res.json();
    setParticipations(data.participations || []);
  };
  const fetchPreferredEquity = async () => {
    const res = await fetch('/api/exchange-programs/preferred-equity');
    if (!res.ok) return;
    const data = await res.json();
    setPreferredEquity(data.tokens || []);
  };
 
  useEffect(() => {
    fetchTrades();
    fetchMarketplace(); 
    fetchMiniCmbs();
    fetchParticipations();
    fetchPreferredEquity();
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

    const notify = message => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const settleTrade = async id => {
    const res = await fetch(`/api/trades/${id}/settle`, { method: 'POST' });
    if (res.ok) {
     notify('Trade settled');
      fetchTrades();
    } else {
     notify('Failed to settle trade');
    }
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
        <section className="mb-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="border rounded p-4 bg-white shadow-sm">
            <h2 className="text-xl font-semibold mb-2">Submit Trade</h2>
            <TradeForm
              onSubmitted={() => {
                fetchTrades();
                notify('Trade submitted');
              }}
            />
          </div>
          <div className="border rounded p-4 bg-white shadow-sm">
            <Marketplace
              entries={marketEntries}
              onSubmitted={() => {
                fetchMarketplace();
                notify('Marketplace order posted');
              }}
            />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          <TradeList trades={openTrades} title="Open Trades" onSettle={settleTrade} />
          <TradeList trades={completedTrades} title="Settled Trades" />
        </div>
      </section>
      <MiniCmbsPools
        pools={cmbsPools}
        onRefresh={fetchMiniCmbs}
        onNotify={notify}
      />
      <ParticipationMarketplace
        listings={participations}
        onRefresh={fetchParticipations}
        onNotify={notify}
      />
      <PreferredEquityTokens
        tokens={preferredEquity}
        onRefresh={fetchPreferredEquity}
        onNotify={notify}
      /> 
    </div>
  );
}
