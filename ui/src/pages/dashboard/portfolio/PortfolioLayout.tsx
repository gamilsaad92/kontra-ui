import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { label: 'Overview',       to: '/portfolio/overview' },
  { label: 'Loans',          to: '/portfolio/loans' },
  { label: 'Assets',         to: '/portfolio/assets' },
  { label: 'Covenants',      to: '/portfolio/covenants' },
  { label: 'Syndication',    to: '/portfolio/syndication' },
  { label: 'AI Underwriter', to: '/portfolio/underwriting', isAI: true },
  { label: 'Originate',      to: '/portfolio/originate',    isPrimary: true },
];

export default function PortfolioLayout() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Portfolio</h1>
        <p className="mt-1 text-sm text-gray-500">
          Structured loan and asset records — the source of truth for servicing, compliance, and tokenization.
        </p>
      </div>
      <nav className="flex gap-1.5 overflow-x-auto border-b border-gray-200 pb-3" style={{ scrollbarWidth: "none" }}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end
            className={({ isActive }) => {
              if (isActive) return 'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium text-white';
              if (tab.isPrimary) return 'shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white';
              if (tab.isAI) return 'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors text-ai-purple hover:opacity-80';
              return 'shrink-0 rounded-full px-4 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900';
            }}
            style={({ isActive }) => {
              if (isActive) return { background: '#0F172A' };
              if (tab.isAI) return { background: '#F3F0FF', border: '1px solid rgba(124,92,255,0.2)', color: '#7C5CFF' };
              return {};
            }}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
