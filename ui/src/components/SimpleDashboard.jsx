import React from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import DashboardCard from './DashboardCard';

const links = [
  { label: 'Dashboard', to: '#' },
  { label: 'Land Acquisition', to: '#' },
  { label: 'Market Analysis', to: '#' },
  { label: 'Settings', to: '#' }
];

const cards = [
  { icon: '🔍', title: 'AI-Powered Property Search', subtitle: 'Site Suitability Analysis' },
  { icon: '📍', title: 'Site Selection', subtitle: 'Location Intelligence' },
  { icon: '📊', title: 'Market Trends', subtitle: 'AI Insights' },
  { icon: '⚙️', title: 'Settings Overview', subtitle: 'Configuration' }
];

export default function SimpleDashboard() {
  return (
    <div className="flex bg-gray-900 min-h-screen text-white">
      <Sidebar links={links} />
      <div className="flex-1 flex flex-col">
        <TopBar title="Dashboard" />
        <main className="p-6 grid gap-6 md:grid-cols-2">
          {cards.map((c, i) => (
            <DashboardCard key={i} {...c} />
          ))}
        </main>
      </div>
    </div>
  );
}
