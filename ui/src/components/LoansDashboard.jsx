import React from 'react';
import { useNavigate } from 'react-router-dom';

const slug = str => str.toLowerCase().replace(/\s+/g, '-');

const features = [
  { label: 'New Application' },
  { label: 'Application List' },
  { label: 'Underwriting Board' },
  { label: 'Decisions' },
  { label: 'Escrows' },
  { label: 'Payment Portal' },
  { label: 'Self Service Payment' },
  { label: 'Troubled Assets' },
  { label: 'Revived Sales' },
  { label: 'Reports' },
  { label: 'Investor Reports' },
  { label: 'Market Analysis' },
  { label: 'Live Analytics' },
  { label: 'Collections' },
  { label: 'Settings' },
  { label: 'Docs', href: 'https://github.com/kontra-ui/docs' }
];

export default function LoansDashboard() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Loans</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {features.map(f => {
          const handleClick = () => {
            if (f.href) {
              window.open(f.href, '_blank');
            } else {
              navigate(f.label === 'Dashboard' ? '/' : `/${slug(f.label)}`);
            }
          };
          return (
            <button
              key={f.label}
              onClick={handleClick}
              className="p-4 bg-gray-700 rounded hover:bg-gray-600 text-left"
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
