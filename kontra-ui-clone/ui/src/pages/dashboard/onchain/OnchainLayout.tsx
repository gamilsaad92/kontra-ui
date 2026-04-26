import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
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
          Compliance-first, permissioned digital debt infrastructure. All tokens are regulated securities with transfer restrictions enforced at issuance, tied to real servicing asset records.
        </p>
      </div>
      <nav
        className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-3 scrollbar-hide"
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
