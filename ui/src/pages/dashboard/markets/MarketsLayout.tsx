import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { label: 'Loan Pools',        to: '/markets/pools' },
  { label: 'Secondary Market',  to: '/markets/secondary', highlight: true },
  { label: 'Settlement History',to: '/markets/trades' },
];

export default function MarketsLayout() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Capital Markets</h1>
        <p className="mt-1 text-sm text-slate-500">
          Loan pool structuring, secondary market activity, and settlement history for your portfolio. Token issuance is managed under the Tokenization module.
        </p>
      </div>
      <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-3" style={{ scrollbarWidth: 'none' }}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end
            className={({ isActive }) =>
              isActive
                ? 'shrink-0 rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white'
                : (tab as any).highlight
                ? 'shrink-0 rounded-full border border-brand-300 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100'
                : 'shrink-0 rounded-full bg-slate-100 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-200'
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
