import { TrendingUp, Percent, CircleDollarSign } from "lucide-react";

function Kpi({ title, value, caption }: {title:string; value:string; caption?:string}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="text-sm text-slate-500 dark:text-slate-400">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {caption && <div className="mt-1 text-xs text-slate-400">{caption}</div>}
    </div>
  );
}

export default function PortfolioOverview() {
  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi title="Total Loans" value="1,250" caption="Active & current" />
        <Kpi title="Delinquency Rate" value="3.8%" caption="30+ days past due" />
        <Kpi title="Avg. Interest Rate" value="5.3%" caption="Weighted average" />
      </div>

      {/* Core grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Loan Applications table */}
        <section className="col-span-12 lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <header className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-medium">Loan Applications</h3>
            <button className="text-xs px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800">View all</button>
          </header>
          <div className="overflow-x-auto p-2">
            <table className="min-w-full text-sm">
              <thead className="text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Applicant</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["John Bouc", "$50,000", "In review", "1h ago"],
                  ["John Froe", "$100,000", "Approved", "Pending"],
                  ["John Whiten", "$180,000", "Pending", "Today"],
                  ["Sieve Stramer", "$200,000", "Pending", "Apr"],
                ].map(([a,b,c,d],i)=>(
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2">{a}</td>
                    <td className="px-3 py-2">{b}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full text-xs border border-slate-200 dark:border-slate-700">{c}</span>
                    </td>
                    <td className="px-3 py-2">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Underwriting Summary donut */}
        <section className="col-span-12 lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <header className="mb-3"><h3 className="font-medium">Underwriting Summary</h3></header>
          <div className="h-40 grid place-items-center">
            <div className="relative h-28 w-28 rounded-full border-[10px] border-slate-200 dark:border-slate-800">
              <div className="absolute inset-0 rounded-full border-[10px] border-emerald-500 clip-path-[inset(0_0_40%_0)]" />
            </div>
            <div className="mt-2 text-sm text-slate-500">85% Approved</div>
          </div>
        </section>

        {/* Loan Volume */}
        <section className="col-span-12 lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <header className="mb-2"><h3 className="font-medium">Loan Volume</h3></header>
          <div className="h-44 grid grid-cols-12 items-end gap-2">
            {Array.from({length:12}).map((_,i)=>(
              <div key={i} className="bg-slate-300 dark:bg-slate-700 rounded-md" style={{height:`${30 + i*4}px`}} />
            ))}
          </div>
        </section>

        {/* Right column cards */}
        <section className="col-span-12 lg:col-span-4 space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h3 className="font-medium mb-3">Portfolio insights</h3>
            <div className="h-28 w-full rounded-md bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700" />
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h3 className="font-medium mb-3">Trading Activity</h3>
            <ul className="text-sm space-y-2">
              <li className="flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Loan Sale — $500,000</li>
              <li className="flex items-center gap-2"><CircleDollarSign className="h-4 w-4" /> Syndication — $250,000</li>
              <li className="flex items-center gap-2"><Percent className="h-4 w-4" /> Repo — $120,000</li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h3 className="font-medium mb-3">Compliance Overview</h3>
            <ul className="text-sm list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-400">
              <li>Regulatory Scans</li>
              <li>Audit Logs</li>
              <li>PCI Checks</li>
            </ul>
          </div>
        </section>

        {/* Recent Activity */}
        <section className="col-span-12 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <header className="mb-2"><h3 className="font-medium">Recent Activity</h3></header>
          <ul className="text-sm text-slate-600 dark:text-slate-400 grid md:grid-cols-2 lg:grid-cols-3 gap-2">
            <li>📝 Sign documents — 1 hour ago</li>
            <li>✅ Approval request (Loan #2324) — 2 hours ago</li>
            <li>💸 Payment received — 3 hours ago</li>
            <li>📤 Draw request opened — 1 day ago</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
