import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
 { label: 'Payments', to: '/servicing/payments' },
  { label: 'Inspections', to: '/servicing/inspections' },
  { label: 'Draws', to: '/servicing/draws' },
  { label: 'Escrows', to: '/servicing/escrow' },
  { label: 'Borrower Financials', to: '/servicing/borrower-financials' },
  { label: 'Management', to: '/servicing/management' },
];

type Props = { orgId?: string | number | null };

export default function ServicingLayout(_props: Props) {
  return (
     <div className="space-y-4">
      <h1 className="text-xl font-semibold">Servicing</h1>
      <nav className="flex flex-wrap gap-2 border-b pb-3">
        {tabs.map((tab) => (
          <NavLink key={tab.label} to={tab.to} className="rounded-full bg-slate-100 px-4 py-1.5 text-sm">
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
