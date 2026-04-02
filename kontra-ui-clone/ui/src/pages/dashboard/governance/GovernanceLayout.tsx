import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { label: 'Compliance', to: '/governance/compliance' },
  { label: 'Legal', to: '/governance/legal' },
  { label: 'Regulatory', to: '/governance/regulatory-scans' },
  { label: 'Risk Flags', to: '/governance/risk' },
  { label: 'Document Review', to: '/governance/document-review' },
];

export default function GovernanceLayout() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Compliance</h1>
        <p className="text-sm text-slate-500 mt-0.5">Regulatory checks, legal status, and risk flags — every item resolved before an asset advances.</p>
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
