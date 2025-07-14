import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { API_BASE } from '../lib/apiBase';
import VirtualAssistant from './VirtualAssistant';

export default function HospitalityDashboard({ setActive }) {
  const [occDaily, setOccDaily] = useState([]);
  const [adrData, setAdrData] = useState([]);
  const [revParData, setRevParData] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/hospitality/metrics`);
        const data = await res.json();
        setOccDaily(data.occDaily || []);
        setAdrData(data.adrData || []);
        setRevParData(data.revParData || []);
      } catch {
        // fallback sample data
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        setOccDaily(days.map((d, i) => ({ day: d, occupancy: 70 + i })));
        setAdrData(days.map((d, i) => ({ day: d, adr: 120 + i * 2 })));
        setRevParData(days.map((d, i) => ({ day: d, revpar: 80 + i * 3 })));
      }
    })();
  }, []); 
  return (
    <div className="space-y-6">
      <div className="space-x-2 mb-4">
        {setActive && (
          <>
            <button
              onClick={() => setActive('Guest CRM')}
              className="bg-blue-600 text-white px-3 py-1 rounded"
            >
              Guest CRM
            </button>
            <button
              onClick={() => setActive('Guest Chat')}
              className="bg-blue-600 text-white px-3 py-1 rounded"
            >
              Guest Chat
            </button>
          </>
        )}
      </div>
      <div>
        <h3 className="font-bold mb-2">Daily Occupancy</h3>
        <LineChart width={600} height={200} data={occDaily} className="mx-auto">
          <XAxis dataKey="day" />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Line type="monotone" dataKey="occupancy" stroke="#8884d8" />
        </LineChart>
      </div>
      <div>
        <h3 className="font-bold mb-2">Average Daily Rate (ADR)</h3>
        <LineChart width={600} height={200} data={adrData} className="mx-auto">
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="adr" stroke="#82ca9d" />
        </LineChart>
      </div>
      <div>
        <h3 className="font-bold mb-2">RevPAR</h3>
        <LineChart width={600} height={200} data={revParData} className="mx-auto">
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="revpar" stroke="#ffc658" />
        </LineChart>
      </div>
           <div className="border-t pt-4">
        <VirtualAssistant placeholder="Ask about hospitality…" />
      </div>
    </div>
  );
}
