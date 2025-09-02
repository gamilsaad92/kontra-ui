import React from "react";

const navItems = [
  "Assets",
  "Inspections",
  "Dashboard",
  "Draws",
  "Events",
  "Documents",
  "Users",
  "Orders",
  "Payments",
  "Organizations",
  "Reports",
  "Data",
  "Analytics",
  "Replication Ops",
  "Risk",
  "Webhooks",
  "Support",
];

function LineChart() {
  return (
    <svg viewBox="0 0 200 60" className="w-full h-24 text-sky-500">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        points="0,40 20,30 40,35 60,20 80,25 100,10 120,20 140,15 160,25 180,12 200,18"
      />
    </svg>
  );
}

export default function SaasDashboard() {
  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-6 py-4 text-lg font-semibold">Saas Copular</div>
        <nav className="flex-1 px-2 space-y-1">
          {navItems.map((item) => (
            <a
              key={item}
              href="#"
              className={`block rounded-md px-3 py-2 text-sm ${
                item === "Dashboard"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {item}
            </a>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Loans & Draws */}
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-600">Loans & Draws</h3>
                <p className="mt-2 text-3xl font-bold">1,542</p>
                <p className="mt-1 text-sm text-slate-600">
                  Loans Past Due <span className="font-semibold text-slate-900">136</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-600">Escrow Balance</p>
                <p className="mt-2 text-xl font-semibold">$12,506,038</p>
              </div>
            </div>
          </div>

          {/* Predictive Analytics */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-slate-600 mb-4">Predictive Analytics</h3>
            <LineChart />
          </div>

          {/* Analytics Dashboard */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-slate-600 mb-4">Analytics Dashboard</h3>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm text-slate-600">Total Orders</dt>
                <dd className="text-2xl font-bold">32,010</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-600">Total Spent</dt>
                <dd className="text-2xl font-bold">$5,412,708</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-600">Net Profit</dt>
                <dd className="text-2xl font-bold">17.3%</dd>
              </div>
            </dl>
          </div>

          {/* Customer Communications */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-slate-600 mb-4">Customer Communications</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1">Date</th>
                  <th className="py-1">Type</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr>
                  <td className="py-1">04/22/2024</td>
                  <td className="py-1">Email Sent</td>
                  <td className="py-1">Delivered</td>
                </tr>
                <tr>
                  <td className="py-1">04/21/2024</td>
                  <td className="py-1">SMS Sent</td>
                  <td className="py-1">Sent</td>
                </tr>
                <tr>
                  <td className="py-1">04/20/2024</td>
                  <td className="py-1">Webhook</td>
                  <td className="py-1">Received</td>
                </tr>
                <tr>
                  <td className="py-1">04/19/2024</td>
                  <td className="py-1">Push</td>
                  <td className="py-1">Failed</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Hyperautomation Workflows */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-slate-600 mb-4">Hyperautomation Workflows</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1">Workflow</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr>
                  <td className="py-1">Sync Records</td>
                  <td className="py-1 text-green-600">Completed</td>
                </tr>
                <tr>
                  <td className="py-1">Transfer Loans</td>
                  <td className="py-1 text-green-600">Completed</td>
                </tr>
                <tr>
                  <td className="py-1">Post Highlights</td>
                  <td className="py-1 text-sky-600">In Progress</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Asset Management */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-slate-600 mb-4">Asset Management</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1">Asset</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr>
                  <td className="py-1">Asset 123</td>
                  <td className="py-1">Reviewed</td>
                </tr>
                <tr>
                  <td className="py-1">Asset 456</td>
                  <td className="py-1">Awaiting Review</td>
                </tr>
                <tr>
                  <td className="py-1">Asset 789</td>
                  <td className="py-1">Flagged</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Voice Bot */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-slate-600 mb-4">Voice Bot</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1">Date</th>
                  <th className="py-1">Caller</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr>
                  <td className="py-1">04/22/2024</td>
                  <td className="py-1">+1-555-0123</td>
                  <td className="py-1">Handled</td>
                </tr>
                <tr>
                  <td className="py-1">04/21/2024</td>
                  <td className="py-1">+1-555-0456</td>
                  <td className="py-1">Routed</td>
                </tr>
                <tr>
                  <td className="py-1">04/20/2024</td>
                  <td className="py-1">+1-555-0789</td>
                  <td className="py-1">Missed</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Asset Management Summary */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-sm font-medium text-slate-600 mb-4">Asset Management</h3>
            <ul className="space-y-1 text-sm text-slate-700">
              <li>Asset 123 – All summary uploaded</li>
              <li>Asset 456 – Awaiting valuation</li>
              <li>Asset 789 – Review in progress</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
