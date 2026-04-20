import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { label: 'Overview', to: '/portfolio/overview' },
  { label: 'Loans', to: '/portfolio/loans' },
  { label: 'Assets', to: '/portfolio/assets' },
  { label: 'Originate', to: '/portfolio/originate', highlight: true },
];

export default function PortfolioLayout() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Portfolio</h1>
        <p className="mt-1 text-sm text-slate-500">
          Structured loan and asset records — the source of truth for servicing, compliance, and tokenization.
        </p>
      </div>
      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end
            className={({ isActive }) =>
              isActive
                ? 'rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white'
                : tab.highlight
                ? 'rounded-full border border-brand-300 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100'
                : 'rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-200'
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
