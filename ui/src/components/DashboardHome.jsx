import React from "react";

const Card = ({ title, right, className = "", children }) => (
 <section
    className={`rounded-xl border border-red-900/70 bg-red-950/60 shadow-lg shadow-red-950/40 backdrop-blur ${className}`}
  >
    <header className="flex items-center justify-between px-4 py-3 border-b border-red-900/70">
      <h3 className="text-sm font-semibold text-red-100">{title}</h3>
      {right}
    </header>
  <div className="p-4 text-red-50">{children}</div>
  </section>
);

const Pill = ({ tone = "gray", children }) => {
  const t = {
  gray: "bg-red-900/60 text-red-100 border-red-800",
    green: "bg-emerald-900/40 text-emerald-100 border-emerald-700/60",
    sky: "bg-sky-900/30 text-sky-100 border-sky-700/60",
    amber: "bg-amber-900/40 text-amber-100 border-amber-700/60",
    red: "bg-rose-900/50 text-rose-100 border-rose-800/70",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border ${t}`}>
      {children}
    </span>
  );
};

const MiniSpark = ({ className = "h-16" }) => (
 <svg viewBox="0 0 200 60" className={`w-full ${className} text-red-500`}>
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
   <div className="space-y-6 text-red-50">
      <div className="flex flex-col gap-4 rounded-2xl border border-red-900/70 bg-gradient-to-r from-red-950 via-red-900 to-red-800 px-6 py-5 shadow-xl shadow-red-950/50 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo-dark.png" alt="Kontra logo" className="h-12 w-auto" />
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-red-200/80">Kontra Dashboard</p>
            <h2 className="text-2xl font-semibold text-red-50">Control your lending and servicing in one place</h2>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-red-100">
          <div className="rounded-lg border border-red-900/70 bg-red-900/50 px-3 py-2 text-right">
            <p className="text-xs text-red-200/80">Active Loans</p>
            <p className="text-xl font-semibold text-red-50">1,542</p>
          </div>
          <div className="rounded-lg border border-red-900/70 bg-red-900/50 px-3 py-2 text-right">
            <p className="text-xs text-red-200/80">At Risk</p>
            <p className="text-xl font-semibold text-amber-200">214</p>
          </div>
        </div>
      </div>
     
      {/* Row 1 */}
      <div className="grid grid-cols-12 gap-6">
        <Card title="Loans & Draws" className="col-span-12 lg:col-span-4">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-6">
                 <div className="text-3xl font-semibold text-red-50">1,542</div>
              <p className="mt-1 text-xs text-red-200">Loans Past Due</p>
            </div>
            <div className="col-span-6"><MiniSpark /></div>
            <div className="col-span-12">
            <p className="text-xs uppercase tracking-wide text-red-200">Escrow Balance</p>
              <div className="text-2xl font-semibold text-red-50">$12,506,038</div>
            </div>
          </div>
        </Card>

        <Card title="Predictive Analytics" className="col-span-12 lg:col-span-4">
          <MiniSpark className="h-20" />
        </Card>

        <Card title="Analytics Dashboard" className="col-span-12 lg:col-span-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-red-200">Total Orders</p>
              <div className="text-3xl font-semibold text-red-50">32,010</div>
            </div>
            <div>
            <p className="text-xs uppercase tracking-wide text-red-200">Tip Percent</p>
              <div className="text-3xl font-semibold text-red-50">17,3%</div>
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
              <tr className="text-left text-red-200">
                <th className="py-2">Date</th><th className="py-2">Channel</th><th className="py-2">Status</th>
              </tr>
            </thead>
               <tbody className="divide-y divide-red-900/60">
              <tr><td className="py-2">04/22/2024</td><td>Email</td><td><Pill>Sent</Pill></td></tr>
              <tr><td className="py-2">04/21/2024</td><td>SMS</td><td><Pill tone="green">Delivered</Pill></td></tr>
              <tr><td className="py-2">04/20/2024</td><td>Push Tietjulfs</td><td><Pill tone="amber">Alert</Pill></td></tr>
            </tbody>
          </table>
        </Card>

        <Card title="Hyperautomation Workflows" className="col-span-12 lg:col-span-4">
          <table className="w-full text-sm">
            <thead>
            <tr className="text-left text-red-200">
                <th className="py-2">Workflow</th><th className="py-2">Status</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-red-900/60">
              <tr><td className="py-2">Summarize Document</td><td><Pill tone="green">Completed</Pill></td></tr>
              <tr><td className="py-2">Sync Records</td><td><Pill tone="green">Completed</Pill></td></tr>
              <tr><td className="py-2">Transfer Records</td><td><Pill tone="sky">Completed</Pill></td></tr>
            </tbody>
          </table>
        </Card>

        <Card title="Asset Management" className="col-span-12 lg:col-span-4">
          <table className="w-full text-sm">
            <thead>
       <tr className="text-left text-red-200">
                <th className="py-2">Asset</th><th className="py-2">Risk</th><th className="py-2"></th>
              </tr>
            </thead>
       <tbody className="divide-y divide-red-900/60">
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
            <thead><tr className="text-left text-red-200"><th className="py-2">Workflow</th><th className="py-2">Status</th></tr></thead>
            <tbody className="divide-y divide-red-900/60">
              <tr><td className="py-2">Summarize Document</td><td><Pill tone="green">Completed</Pill></td></tr>
              <tr><td className="py-2">Sync Records</td><td><Pill tone="green">Completed</Pill></td></tr>
              <tr><td className="py-2">Transfer Records</td><td><Pill tone="sky">Completed</Pill></td></tr>
            </tbody>
          </table>
        </Card>

        <Card title="Voice Bot" className="col-span-12 lg:col-span-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-red-200"><th className="py-2">Date</th><th className="py-2">Caller</th><th className="py-2">Outcome</th></tr></thead>
            <tbody className="divide-y divide-red-900/60">
              <tr><td className="py-2">04/22/2024</td><td>+1-555-0134</td><td><Pill tone="red">Churn</Pill></td></tr>
              <tr><td className="py-2">04/20/2024</td><td>+1-585-0275</td><td><Pill>Support Request</Pill></td></tr>
            </tbody>
          </table>
        </Card>

        <Card title="Voice Bot" className="col-span-12 lg:col-span-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-red-200"><th className="py-2">Date</th><th className="py-2">Caller</th><th className="py-2">Outcome</th></tr></thead>
            <tbody className="divide-y divide-red-900/60">
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
              <tr className="text-left text-red-200">
                <th className="py-2">Asset</th><th className="py-2">Risk</th>
                <th className="py-2">Inspection File</th><th className="py-2">Notes</th>
              </tr>
            </thead>
      <tbody className="divide-y divide-red-900/60">
              <tr><td className="py-2">Asset 123</td><td>Troubled</td><td><Pill>AI summary uploaded</Pill></td><td>—</td></tr>
              <tr><td className="py-2">Asset 456</td><td>Revived</td><td><Pill>AI summary uploaded</Pill></td><td>—</td></tr>
            </tbody>
          </table>
        </Card>

        <Card title="Voice Bot" className="col-span-12 lg:col-span-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-red-200"><th className="py-2">Date</th><th className="py-2">Caller</th><th className="py-2">Outcome</th></tr></thead>
            <tbody className="divide-y divide-red-900/60">
              <tr><td className="py-2">04/22/2024</td><td>+1-555-0134</td><td><Pill tone="red">Churn</Pill></td></tr>
              <tr><td className="py-2">04/20/2024</td><td>+1-585-0275</td><td><Pill>Support Request</Pill></td></tr>
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
