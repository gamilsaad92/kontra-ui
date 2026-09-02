import LoansDashboard from "../../../components/LoansDashboard";
import AssetManagement from "../../../routes/AssetManagement";

export default function ServicingLoansPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Loan portfolio</h2>
        <p className="text-sm text-slate-500">
          Reuse existing loan analytics and asset workflows inside servicing.
        </p>
        <div className="mt-4">
          <LoansDashboard />
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Asset review workflows</h2>
        <p className="text-sm text-slate-500">
          Continue asset reviews, inspections, and management change requests from the servicing hub.
        </p>
        <div className="mt-4">
          <AssetManagement />
        </div>
      </section>
    </div>
  );
}
