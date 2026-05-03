import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { label: 'Loan Control',     to: '/governance/loan-control',    isPrimary: true },
  { label: 'Governance',       to: '/governance/proposals',       isPrimary: true },
  { label: 'Policy Rules',     to: '/governance/rules',           isPrimary: true },
  { label: 'Cure Workflows',   to: '/governance/cure-workflows',  isPrimary: true },
  { label: 'Compliance',       to: '/governance/compliance' },
  { label: 'Legal',            to: '/governance/legal' },
  { label: 'Regulatory',       to: '/governance/regulatory-scans' },
  { label: 'Risk',             to: '/governance/risk' },
  { label: 'Document Reviews', to: '/governance/document-review' },
];

export default function GovernanceLayout() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Compliance & Legal</h1>
        <p className="mt-1 text-sm text-gray-500">
          Compliance tracking, document review, regulatory monitoring, and risk controls across your loan portfolio.
        </p>
      </div>
      <nav className="flex gap-1.5 overflow-x-auto border-b border-gray-200 pb-3" style={{ scrollbarWidth: "none" }}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end
            className={({ isActive }) => {
              if (isActive) return 'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium text-white';
              if (tab.isPrimary) return 'shrink-0 rounded-full px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100';
              return 'shrink-0 rounded-full px-4 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700';
            }}
            style={({ isActive }) => isActive ? { background: '#0F172A' } : {}}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
