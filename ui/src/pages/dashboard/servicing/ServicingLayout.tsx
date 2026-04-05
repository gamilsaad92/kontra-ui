import { NavLink, Outlet } from 'react-router-dom';
import { ServicingProvider } from './ServicingContext';

const tabs = [
  { label: 'Overview', to: '/servicing/overview' },
  { label: 'Payments', to: '/servicing/payments' },
  { label: 'Inspections', to: '/servicing/inspections' },
  { label: 'Draws', to: '/servicing/draws' },
  { label: 'Escrows', to: '/servicing/escrow' },
  { label: 'Borrower Financials', to: '/servicing/borrower-financials' },
  { label: 'Management', to: '/servicing/management' },
  { label: 'AI Operations', to: '/servicing/ai-ops' },
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
        <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
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
