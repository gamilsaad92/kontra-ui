import React from 'react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import DashboardCard from '../components/DashboardCard.jsx';
import { FiSearch, FiMapPin, FiBarChart2, FiClipboard } from 'react-icons/fi';

const cards = [
  { icon: <FiSearch />, title: 'AI-Powered Property Search' },
  { icon: <FiMapPin />, title: 'Site Suitability Analysis' },
  { icon: <FiBarChart2 />, title: '12 Reports', subtitle: 'Generated this month' },
  { icon: <FiClipboard />, title: '8 Transactions', subtitle: 'Awaiting review' },
];

export default function Dashboard() {
  return (
  <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col bg-gray-900">
        <TopBar />
        <main className="p-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {cards.map(c => (
            <DashboardCard key={c.title} {...c} />
    ))}
             </main>
      </div>
    </div>
  );
}
