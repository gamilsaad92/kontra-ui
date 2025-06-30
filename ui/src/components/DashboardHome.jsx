import React, { useContext, useEffect, useState } from 'react';
import RiskGauge from './RiskGauge';
import DelinquencyChart from './DelinquencyChart';
import RecentActivityTable from './RecentActivityTable';
import GuestOccupancyChart from './GuestOccupancyChart';
import { AuthContext } from '../main';
import { supabase } from '../lib/supabaseClient';

const DEFAULT_LAYOUT = [
  { id: 'risk', w: 1, hidden: false },
  { id: 'delinquency', w: 1, hidden: false },
  { id: 'activity', w: 2, hidden: false },
  { id: 'occupancy', w: 2, hidden: false }
];

export default function DashboardHome({ setActive }) {
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
    risk: (
      <div className="bg-white rounded shadow p-4 flex items-center justify-center h-full">
        <RiskGauge value={72} />
      </div>
         ),
    delinquency: (
      <div className="bg-white rounded shadow p-4 h-full">
        <h3 className="font-bold mb-2">Delinquency Forecast</h3>
        <DelinquencyChart />
      </div>
        ),
    activity: (
      <div className="bg-white rounded shadow p-4 h-full">
        <h3 className="font-bold mb-2">Recent Activity</h3>
        <RecentActivityTable />
      </div>
          ),
    occupancy: (
      <div className="bg-white rounded shadow p-4 h-full">
        <h3 className="font-bold mb-2">Guest Occupancy</h3>
        <GuestOccupancyChart />
      </div>
          )
  };

  if (loading) return <p>Loading dashboard…</p>;

  const hidden = layout.filter(l => l.hidden);

  return (
    <div className="space-y-4">
      <div className="flex space-x-2">
        <button
          onClick={() => setActive && setActive('Create Loan')}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          New Loan
        </button>
        <button
          onClick={() => setActive && setActive('New Application')}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          New Application
        </button>
        <button
          onClick={() => setActive && setActive('New Request')}
          className="bg-blue-600 text-white px-3 py-1 rounded"
        >
          New Draw Request
        </button>
         <button
          onClick={() => setActive && setActive('Draw Board')}
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
