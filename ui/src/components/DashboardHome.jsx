import React from "react";

const Card = ({ title, right, className = "", children }) => (
  <section className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
    <header className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {right}
    </header>
    <div className="p-4">{children}</div>
  </section>
);

const Pill = ({ tone = "gray", children }) => {
  const t = {
    gray: "bg-slate-100 text-slate-700 border-slate-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border ${t}`}>
      {children}
    </span>
  );
};

const MiniSpark = ({ className = "h-16" }) => (
  <svg viewBox="0 0 200 60" className={`w-full ${className} text-sky-500`}>
    <polyline
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      points="0,40 15,32 30,35 45,28 60,22 75,26 90,18 105,21 120,14 135,20 150,12 165,16 180,10 200,18"
    />
  </svg>
);

export default function DashboardHome() {
  return (
    <div className="space-y-6">
      {/* Row 1 */}
      <div className="grid grid-cols-12 gap-6">
        <Card title="Loans & Draws" className="col-span-12 lg:col-span-4">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-6">
              <div className="text-3xl font-semibold text-slate-900">1,542</div>
              <p className="mt-1 text-xs text-slate-500">Loans Past Due</p>
            </div>
            <div className="col-span-6"><MiniSpark /></div>
            <div className="col-span-12">
              <p className="text-xs uppercase tracking-wide text-slate-500">Escrow Balance</p>
              <div className="text-2xl font-semibold">$12,506,038</div>
            </div>
          </div>
        </Card>

        <Card title="Predictive Analytics" className="col-span-12 lg:col-span-4">
          <MiniSpark className="h-20" />
        </Card>

        <Card title="Analytics Dashboard" className="col-span-12 lg:col-span-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Total Orders</p>
              <div className="text-3xl font-semibold">32,010</div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Tip Percent</p>
              <div className="text-3xl font-semibold">17,3%</div>
            </div>
            <div className="col-span-2"><MiniSpark /></div>
          </div>
        </Card>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-12 gap-6">
        <Card title="Customer Communications" className="col-span-12 lg:col-span-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Date</th><th className="py-2">Channel</th><th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="py-2">04/22/2024</td><td>Email</td><td><Pill>Sent</Pill></td></tr>
              <tr><td className="py-2">04/21/2024</td><td>SMS</td><td><Pill tone="green">Delivered</Pill></td></tr>
              <tr><td className="py-2">04/20/2024</td><td>Push Tietjulfs</td><td><Pill tone="amber">Alert</Pill></td></tr>
            </tbody>
          </table>
        </Card>

        <Card title="Hyperautomation Workflows" className="col-span-12 lg:col-span-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Workflow</th><th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="py-2">Summarize Document</td><td><Pill tone="green">Completed</Pill></td></tr>
              <tr><td className="py-2">Sync Records</td><td><Pill tone="green">Completed</Pill></td></tr>
              <tr><td className="py-2">Transfer Records</td><td><Pill tone="sky">Completed</Pill></td></tr>
            </tbody>
          </table>
        </Card>

        <Card title="Asset Management" className="col-span-12 lg:col-span-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Asset</th><th className="py-2">Risk</th><th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="py-2">Asset 123</td><td>Troubled</td><td><Pill>Upstaked</Pill></td></tr>
              <tr><td className="py-2">Asset 458</td><td>AI Summary</td><td><Pill>Uploaded</Pill></td></tr>
              <tr><td className="py-2">Asset 789</td><td>Revived</td><td><Pill>$595,000</Pill></td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-12 gap-6">
        <Card title="Hyperautomation Workflows" className="col-span-12 lg:col-span-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="py-2">Workflow</th><th className="py-2">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="py-2">Summarize Document</td><td><Pill tone="green">Completed</Pill></td></tr>
              <tr><td className="py-2">Sync Records</td><td><Pill tone="green">Completed</Pill></td></tr>
              <tr><td className="py-2">Transfer Records</td><td><Pill tone="sky">Completed</Pill></td></tr>
            </tbody>
          </table>
        </Card>

        <Card title="Voice Bot" className="col-span-12 lg:col-span-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="py-2">Date</th><th className="py-2">Caller</th><th className="py-2">Outcome</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="py-2">04/22/2024</td><td>+1-555-0134</td><td><Pill tone="red">Churn</Pill></td></tr>
              <tr><td className="py-2">04/20/2024</td><td>+1-585-0275</td><td><Pill>Support Request</Pill></td></tr>
            </tbody>
          </table>
        </Card>

        <Card title="Voice Bot" className="col-span-12 lg:col-span-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="py-2">Date</th><th className="py-2">Caller</th><th className="py-2">Outcome</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="py-2">04/22/2024</td><td>+1-555-0134</td><td>—</td></tr>
              <tr><td className="py-2">04/20/2024</td><td>+1-555-0275</td><td><Pill tone="green">Completed</Pill></td></tr>
              <tr><td className="py-2">04/15/2024</td><td>+1-555-0312</td><td>—</td></tr>
            </tbody>
          </table>
        </Card>
      </div>

      {/* Row 4 */}
      <div className="grid grid-cols-12 gap-6">
        <Card title="Asset Management" className="col-span-12 lg:col-span-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Asset</th><th className="py-2">Risk</th>
                <th className="py-2">Inspection File</th><th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="py-2">Asset 123</td><td>Troubled</td><td><Pill>AI summary uploaded</Pill></td><td>—</td></tr>
              <tr><td className="py-2">Asset 456</td><td>Revived</td><td><Pill>AI summary uploaded</Pill></td><td>—</td></tr>
            </tbody>
          </table>
        </Card>

        <Card title="Voice Bot" className="col-span-12 lg:col-span-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500"><th className="py-2">Date</th><th className="py-2">Caller</th><th className="py-2">Outcome</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              <tr><td className="py-2">04/22/2024</td><td>+1-555-0134</td><td><Pill tone="red">Churn</Pill></td></tr>
              <tr><td className="py-2">04/20/2024</td><td>+1-585-0275</td><td><Pill>Support Request</Pill></td></tr>
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
ui/src/components/Dashboa
