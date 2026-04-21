import React from 'react';

export default function DashboardCard({ icon, title, subtitle }) {
  return (
    <div className="bg-gray-800 rounded shadow p-4 flex space-x-4 items-center">
      <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-xl">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-white">{title}</h3>
        {subtitle && <p className="text-gray-400 text-sm">{subtitle}</p>}
      </div>
    </div>
  );
}
