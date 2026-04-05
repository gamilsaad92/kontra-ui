import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { label: 'Loan Pools', to: '/markets/pools' },
  { label: 'Token Issuances', to: '/markets/tokens' },
  { label: 'Settlement History', to: '/markets/trades' },
];

export default function MarketsLayout() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Capital Markets</h1>
        <p className="mt-1 text-sm text-slate-500">
          Loan pool structuring, token issuance readiness, and settlement activity for your portfolio.
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
