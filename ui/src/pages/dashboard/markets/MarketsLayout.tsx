import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { label: 'Pools', to: '/markets/pools' },
  { label: 'Tokens', to: '/markets/tokens' },
  { label: 'Trades', to: '/markets/trades' },
  { label: 'Exchange Listings', to: '/markets/exchange' },
];

export default function MarketsLayout() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Capital Markets</h1>
      <nav className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((tab) => (
          <NavLink key={tab.label} to={tab.to} className="rounded-full bg-slate-100 px-4 py-1.5 text-sm">{tab.label}</NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
