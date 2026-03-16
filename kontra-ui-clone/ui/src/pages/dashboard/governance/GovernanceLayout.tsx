import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { label: 'Compliance', to: '/governance/compliance' },
  { label: 'Legal', to: '/governance/legal' },
  { label: 'Regulatory', to: '/governance/regulatory-scans' },
  { label: 'Risk', to: '/governance/risk' },
  { label: 'Document Reviews', to: '/governance/document-review' },
];

export default function GovernanceLayout() {
  return (
     <div className="space-y-4">
      <h1 className="text-xl font-semibold">Governance</h1>
      <nav className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((tab) => (
          <NavLink key={tab.label} to={tab.to} className="rounded-full bg-slate-100 px-4 py-1.5 text-sm">{tab.label}</NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
