import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

const occDaily = [
  { day: 'Mon', occupancy: 72 },
  { day: 'Tue', occupancy: 75 },
  { day: 'Wed', occupancy: 78 },
  { day: 'Thu', occupancy: 80 },
  { day: 'Fri', occupancy: 85 },
  { day: 'Sat', occupancy: 90 },
  { day: 'Sun', occupancy: 88 }
];

const adrData = [
  { day: 'Mon', adr: 120 },
  { day: 'Tue', adr: 125 },
  { day: 'Wed', adr: 118 },
  { day: 'Thu', adr: 130 },
  { day: 'Fri', adr: 140 },
  { day: 'Sat', adr: 150 },
  { day: 'Sun', adr: 145 }
];

const revParData = [
  { day: 'Mon', revpar: 86 },
  { day: 'Tue', revpar: 94 },
  { day: 'Wed', revpar: 92 },
  { day: 'Thu', revpar: 104 },
  { day: 'Fri', revpar: 119 },
  { day: 'Sat', revpar: 135 },
  { day: 'Sun', revpar: 128 }
];

export default function HospitalityDashboard({ setActive }) {
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
    </div>
  );
}
