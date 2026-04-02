import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { label: 'Loan Records', to: '/portfolio/loans' },
  { label: 'Asset Register', to: '/portfolio/assets' },
];

export default function PortfolioLayout() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Asset Library</h1>
        <p className="text-sm text-slate-500 mt-0.5">Structured loan data assets — every record a standardized, verifiable digital asset.</p>
      </div>
      <nav className="flex flex-wrap gap-2 border-b pb-3">
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
