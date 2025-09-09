import React, { useEffect, useState } from "react";
import { getPortfolioSnapshot } from "../services/analytics";
import { listDrawRequests } from "../services/servicing";
import type { DrawRequest } from "../lib/sdk/types";
import Pill from "../components/Pill";
import MiniSpark from "../components/MiniSpark";
import Card from "../components/SaasCard";
import LeftIcon from "../components/LeftIcon";
import { nav } from "../constants/nav";
import AssetsDashboard from "../modules/assets/AssetsDashboard";
import Inspections from "../routes/Inspections";
import LoansDashboard from "../components/LoansDashboard";
import DrawsDashboard from "../components/DrawsDashboard";
import ProjectsTable from "../components/ProjectsTable";
import OrganizationAccounts from "../components/OrganizationAccounts";

export default function SaasDashboard() {
   const [portfolio, setPortfolio] =
    useState<{ delinqPct: number; points: number[] } | null>(null);
  const [draws, setDraws] = useState<DrawRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState("Dashboard");
   
  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      try {
        const [p, d] = await Promise.all([
          getPortfolioSnapshot(),
          listDrawRequests(),
        ]);
        if (!isMounted) return;
      setPortfolio(p ?? null);
        setDraws(Array.isArray(d) ? d : []);
      } catch (err) {
        console.error(err);
        if (isMounted)
          setError(err instanceof Error ? err.message : "Failed to load metrics");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  const drawCount = draws.length;
  const escrowBalance = draws.reduce((sum, r) => sum + (r?.amount ?? 0), 0);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const formatSpark = (points: number[]) => {
    if (!points || points.length === 0) return undefined;
    const step = 200 / (points.length - 1);
    const max = Math.max(...points);
    const min = Math.min(...points);
    return points
      .map((p, i) => {
        const y = 60 - ((p - min) / (max - min || 1)) * 60;
        return `${i * step},${y}`;
      })
      .join(" ");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">Loading...</div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">
        {error}
      </div>
    );
  }

  const spark = portfolio ? formatSpark(portfolio.points) : undefined;

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-950 text-slate-100 flex flex-col">
        <div className="px-4 py-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800">
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path className="fill-white/90" d="M12 2 3 7v10l9 5 9-5V7zM6 9l6 3 6-3" />
            </svg>
          </span>
          <span><span className="text-red-900">Kontra</span> Popular</span>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          {nav.map((label) => (
            <a
              key={label}
              href="#"
             onClick={(e) => {
                e.preventDefault();
                setActive(label);
              }}
              className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-slate-800 hover:text-white ${
                active === label ? "bg-slate-800 text-white" : "text-slate-300"
              }`}     
               >
              <LeftIcon />
              <span className="truncate">{label}</span>
            </a>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 overflow-y-auto">
          {active === "Assets" ? (
          <AssetsDashboard />
         ) : active === "Inspections" ? (
          <Inspections />
         ) : active === "Loans" ? (
          <LoansDashboard />
               ) : active === "Draws" ? (
          <DrawsDashboard />
                ) : active === "Projects" ? (
    <ProjectsTable />
        ) : active === "Organizations" ? (
          <OrganizationAccounts />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Row 1 */}
              <Card title="Loans & Draws">
            <p className="mt-2 text-3xl font-bold tracking-tight">{drawCount}</p>
            <div className="mt-3">
              {portfolio ? (
                <>
                  <div className="text-xs text-slate-500">
                    Loans Past Due ({portfolio.delinqPct}%)
                  </div>
                  <MiniSpark points={spark} />
                </>
              ) : (
                <div className="text-xs text-slate-500">
                  Portfolio summary unavailable
                </div>
             )}
            </div>
            <div className="mt-2 text-xs text-slate-600">Escrow Balance</div>
            <div className="text-2xl font-semibold tracking-tight">
              {formatCurrency(escrowBalance)}
            </div>
          </Card>

          <Card title="Predictive Analytics">
            <MiniSpark />
          </Card>

          <Card
            title="Analytics Dashboard"
            right={<div className="sr-only" />}
          >
            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <div className="text-xs text-slate-500">Total Orders</div>
                <div className="text-3xl font-bold leading-tight">32,010</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Total</div>
                <div className="text-2xl font-semibold">$5,412,708</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Tip Percent</div>
                <div className="text-2xl font-semibold">17.3%</div>
              </div>
            </div>
            <div className="mt-3">
              <MiniSpark />
            </div>
          </Card>

          {/* Row 2 */}
          <Card title="Customer Communications">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 font-medium">Date</th>
                  <th className="py-1 font-medium">Channel</th>
                  <th className="py-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr>
                  <td className="py-1">04/22/2024</td>
                  <td className="py-1">Email</td>
                  <td className="py-1">Sent</td>
                </tr>
                <tr>
                  <td className="py-1">04/21/2024</td>
                  <td className="py-1">SMS</td>
                  <td className="py-1">Delivered</td>
                </tr>
                <tr>
                  <td className="py-1">04/20/2024</td>
                  <td className="py-1">Push Notifications</td>
                  <td className="py-1">Alert</td>
                </tr>
              </tbody>
            </table>
          </Card>

          <Card title="Hyperautomation Workflows">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 font-medium">Workflow</th>
                  <th className="py-1 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr>
                  <td className="py-1">Summarize Document</td>
                  <td className="py-1"><Pill tone="green">Completed</Pill></td>
                </tr>
                <tr>
                  <td className="py-1">Sync Records</td>
                  <td className="py-1"><Pill tone="green">Completed</Pill></td>
                </tr>
                <tr>
                  <td className="py-1">Transfer Records</td>
                  <td className="py-1"><Pill tone="green">Completed</Pill></td>
                </tr>
              </tbody>
            </table>
          </Card>

          <Card title="Asset Management">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 font-medium">Asset</th>
                  <th className="py-1 font-medium">Risk</th>
                  <th className="py-1 font-medium">&nbsp;</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr>
                  <td className="py-1">Asset 123</td>
                  <td className="py-1">Troubled</td>
                  <td className="py-1"><Pill>Upstaked</Pill></td>
                </tr>
                <tr>
                  <td className="py-1">Asset 458</td>
                  <td className="py-1">AI Summary</td>
                  <td className="py-1"><Pill>Uploaded</Pill></td>
                </tr>
                <tr>
                  <td className="py-1">Asset 789</td>
                  <td className="py-1">Revived</td>
                  <td className="py-1"><Pill>$595,000</Pill></td>
                </tr>
              </tbody>
            </table>
          </Card>

          {/* Row 3 */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-medium text-slate-600">Asset Management</h3>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1 font-medium">Asset</th>
                    <th className="py-1 font-medium">Risk</th>
                    <th className="py-1 font-medium">Inspection File</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  <tr>
                    <td className="py-1">Asset 123</td>
                    <td className="py-1">Troubled</td>
                    <td className="py-1">AI summary uploaded</td>
                  </tr>
                  <tr>
                    <td className="py-1">Asset 456</td>
                    <td className="py-1">Revived</td>
                    <td className="py-1">AI summary uploaded</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
             
          <Card title="Voice Bot">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-1 font-medium">Date</th>
                  <th className="py-1 font-medium">Caller</th>
                  <th className="py-1 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr>
                  <td className="py-1">04/22/2024</td>
                  <td className="py-1">+1‑555‑0134</td>
                  <td className="py-1">Churn</td>
                </tr>
                <tr>
                  <td className="py-1">04/20/2024</td>
                  <td className="py-1">+1‑585‑0275</td>
                  <td className="py-1">Support Request</td>
                </tr>
                <tr>
                  <td className="py-1">04/15/2024</td>
                  <td className="py-1">—</td>
                  <td className="py-1">Completed</td>
                </tr>
              </tbody>
            </table>
          </Card>
          </div>
        )}
      </main>
    </div>
  );
}
