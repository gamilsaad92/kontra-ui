import { NavLink, Outlet } from 'react-router-dom';

export default function PortfolioLayout() {
  return (
    <div className="space-y-4">
      <nav className="flex gap-2 border-b pb-3">
        <NavLink to="/portfolio/loans" className="rounded-full bg-slate-100 px-4 py-1.5 text-sm">Loans</NavLink>
        <NavLink to="/portfolio/assets" className="rounded-full bg-slate-100 px-4 py-1.5 text-sm">Assets</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
