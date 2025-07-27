import React, { useState } from 'react';
import DashboardHome from './DashboardHome';
import AnalyticsDashboard from './AnalyticsDashboard';
import RealTimeAnalyticsDashboard from './RealTimeAnalyticsDashboard';

const tabs = [
  { label: 'Overview', Component: DashboardHome },
  { label: 'Analytics', Component: AnalyticsDashboard },
  { label: 'Live', Component: RealTimeAnalyticsDashboard }
];

export default function DashboardTabs() {
  const [active, setActive] = useState(tabs[0].label);
  const Active = tabs.find(t => t.label === active).Component;

  return (
    <div className="space-y-4">
      <div className="flex border-b border-gray-700 space-x-4">
        {tabs.map(t => (
          <button
            key={t.label}
            onClick={() => setActive(t.label)}
            className={`px-3 py-2 focus:outline-none ${
              active === t.label ? 'border-b-2 border-blue-500' : ''
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>
        <Active />
      </div>
    </div>
  );
}
