import React from 'react';
import { useNavigate } from 'react-router-dom';

const features = [
  { label: 'Portfolio', to: '/lender/portfolio' },
  { label: 'Underwriting', to: '/lender/underwriting' },
  { label: 'Escrow', to: '/lender/escrow' },
  { label: 'Servicing', to: '/lender/servicing' },
  { label: 'Risk Monitoring', to: '/lender/risk' },
  { label: 'Investor Reporting', to: '/lender/investor' },
  { label: 'Collections', to: '/lender/collections' },
  { label: 'Trading', to: '/lender/trading' },
  { label: 'Hospitality', to: '/hospitality' },
  { label: 'Analytics', to: '/analytics' },
  { label: 'Settings', to: '/settings' },
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
             navigate(f.to);
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
