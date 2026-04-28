import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { label: 'Token Gate',         to: '/onchain/gate',          highlight: true },
  { label: 'Token Registry',     to: '/onchain/tokens' },
  { label: 'Investor Registry',  to: '/onchain/investors' },
  { label: 'Cap Table',          to: '/onchain/cap-table' },
  { label: 'Compliance Engine',  to: '/onchain/compliance' },
  { label: 'Distributions',      to: '/onchain/distributions' },
  { label: 'Governance',         to: '/onchain/governance' },
  { label: 'Audit Log',          to: '/onchain/audit' },
];

export default function OnchainLayout() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Tokenization</h1>
        <p className="mt-1 text-sm text-slate-500">
          Compliance-first, permissioned digital debt infrastructure. Servicing is the source of truth.
          Compliance is the gatekeeper. Tokenization is the downstream financial product.
        </p>
      </div>
      <nav
        className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-3"
        style={{ scrollbarWidth: 'none' }}
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end
            className={({ isActive }) =>
              isActive
                ? 'shrink-0 rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white'
                : tab.highlight
                ? 'shrink-0 rounded-full border border-violet-300 bg-violet-50 px-4 py-1.5 text-sm font-bold text-violet-700 hover:bg-violet-100'
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
