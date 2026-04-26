import { NavLink, Outlet } from 'react-router-dom';
import { ServicingProvider } from './ServicingContext';

const tabs = [
  { label: 'Overview',            to: '/servicer/overview' },
  { label: 'Cash Flow',           to: '/servicer/waterfall' },
  { label: 'Payments',            to: '/servicer/payments' },
  { label: 'Delinquency',         to: '/servicer/delinquency' },
  { label: 'Draws',               to: '/servicer/draws' },
  { label: 'Inspections',         to: '/servicer/inspections' },
  { label: 'Escrow',              to: '/servicer/escrow' },
  { label: 'Borrower Financials', to: '/servicer/borrower-financials' },
  { label: 'Management (PMC)',    to: '/servicer/management' },
  { label: 'Review Queue',        to: '/servicer/ai-ops' },
];

export default function ServicingLayout() {
  return (
    <ServicingProvider>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Servicing</h1>
          <p className="mt-1 text-sm text-slate-500">
            Payment processing, inspection workflow, draws, escrow, borrower financials, and management compliance — all in one auditable system.
          </p>
        </div>
        <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-3 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
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
    </ServicingProvider>
  );
}
