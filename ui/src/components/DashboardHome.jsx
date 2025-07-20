import React, { useContext, useEffect, useState } from 'react';
import RiskScoreCard from '../modules/dashboard/RiskScoreCard';
import DelinquencyCard from '../modules/dashboard/DelinquencyCard';
import RecentActivityCard from '../modules/dashboard/RecentActivityCard';
import NextDueCard from '../modules/dashboard/NextDueCard';
import OfferCard from '../modules/dashboard/OfferCard';
import SmartRecommendations from './SmartRecommendations';
import InteractiveFAQs from './InteractiveFAQs';
import GuestOccupancyCard from '../modules/dashboard/GuestOccupancyCard';
import { AuthContext } from '../main';
import { supabase } from '../lib/supabaseClient';

const DEFAULT_LAYOUT = [
  { id: 'risk', w: 1, hidden: false },
  { id: 'delinquency', w: 1, hidden: false },
  { id: 'activity', w: 2, hidden: false },
  { id: 'occupancy', w: 2, hidden: false },
  { id: 'nextDue', w: 1, hidden: false },
  { id: 'offers', w: 1, hidden: false },
  { id: 'faqs', w: 2, hidden: false },
  { id: 'recommendations', w: 2, hidden: false }
];

export default function DashboardHome({ navigateTo }) {
  const { session } = useContext(AuthContext);
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!session) return;
      const { data } = await supabase
        .from('user_dashboard_layout')
        .select('layout')
        .eq('user_id', session.user.id)
        .single();
      if (data?.layout) setLayout(data.layout);
      setLoading(false);
    }
    load();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('user_dashboard_layout')
      .upsert({ user_id: session.user.id, layout });
  }, [layout, session]);

  function handleDrop(e, index) {
    const id = e.dataTransfer.getData('id');
    const from = layout.findIndex(l => l.id === id);
    if (from === -1) return;
    const updated = [...layout];
    const [item] = updated.splice(from, 1);
    updated.splice(index, 0, item);
    setLayout(updated);
  }

  function toggleSize(id) {
    setLayout(l =>
      l.map(it =>
        it.id === id ? { ...it, w: it.w === 2 ? 1 : 2 } : it
      )
    );
  }

  function toggleHide(id) {
    setLayout(l =>
      l.map(it =>
        it.id === id ? { ...it, hidden: !it.hidden } : it
      )
    );
  }

  const widgets = {
      risk: <RiskScoreCard />,
    delinquency: <DelinquencyCard />,
    activity: <RecentActivityCard />,
    occupancy: <GuestOccupancyCard />,
    nextDue: <NextDueCard />,
    offers: <OfferCard />,
    faqs: <InteractiveFAQs userId={session?.user?.id} />,
    recommendations: <SmartRecommendations />
  };

  if (loading) return <p>Loading dashboard…</p>;

  const hidden = layout.filter(l => l.hidden);

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <button
               onClick={() => navigateTo && navigateTo('Create Loan')}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          New Loan
        </button>
        <button
                 onClick={() => navigateTo && navigateTo('New Application')}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          New Application
        </button>
        <button
             onClick={() => navigateTo && navigateTo('New Request')}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          New Draw Request
        </button>
                <button
          onClick={() => navigateTo && navigateTo('Draw Board')}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          Draw Workflow
        </button>
      </div>

      <div className="grid gap-6 grid-cols-2 auto-rows-fr">
        {layout.map((item, idx) =>
          !item.hidden && (
            <div
              key={item.id}
              draggable
              onDragStart={e => e.dataTransfer.setData('id', item.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, idx)}
              className={`relative ${item.w === 2 ? 'col-span-2' : ''}`}
            >
              <div className="absolute top-1 right-1 space-x-1 text-xs">
                <button
                  onClick={() => toggleSize(item.id)}
                  className="bg-gray-200 px-1 rounded"
                >
                  ⇔
                </button>
                <button
                  onClick={() => toggleHide(item.id)}
                  className="bg-gray-200 px-1 rounded"
                >
                  ×
                </button>
              </div>
              {widgets[item.id]}
            </div>
          )
        )}
      </div>

      {hidden.length > 0 && (
        <div className="space-x-2">
          {hidden.map(h => (
            <button
              key={h.id}
              onClick={() => toggleHide(h.id)}
              className="text-sm underline text-blue-600"
            >
              Show {h.id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
