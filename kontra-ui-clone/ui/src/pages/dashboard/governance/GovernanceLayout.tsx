import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { label: 'Loan Control', to: '/governance/loan-control', highlight: true },
  { label: 'Governance', to: '/governance/proposals', highlight: true },
  { label: 'Compliance', to: '/governance/compliance' },
  { label: 'Legal', to: '/governance/legal' },
  { label: 'Regulatory', to: '/governance/regulatory-scans' },
  { label: 'Risk', to: '/governance/risk' },
  { label: 'Document Reviews', to: '/governance/document-review' },
];

export default function GovernanceLayout() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Compliance & Legal</h1>
        <p className="mt-1 text-sm text-slate-500">
          Compliance tracking, document review, regulatory monitoring, and risk controls across your loan portfolio.
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
                  ? 'rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100'
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
