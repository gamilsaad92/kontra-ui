import { useEffect, useMemo, useState } from "react";
import NextDueCard from "../../modules/dashboard/NextDueCard";
import type { Application, Escrow, ApplicationOrchestration } from "../../lib/sdk/types";
import { applications as applicationsClient } from "../../lib/sdk";
import {
  listApplications,
  listUpcomingEscrows,
  getEscrowProjection,
  type EscrowProjectionPoint,
} from "../../services/servicing";
import {
  getLenderOverview,
  getReportSummary,
  type LenderOverview,
  type ReportSummarySnapshot,
} from "../../services/analytics";

type KpiProps = {
  title: string;
  value: string;
  caption?: string;
};

type AiScorecard = NonNullable<
  NonNullable<ApplicationOrchestration["outputs"]>["scorecard"]
>;

function Kpi({ title, value, caption }: KpiProps) {
  return (
     <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      {caption && <div className="mt-1 text-xs text-slate-400">{caption}</div>}
    </div>
  );
}

function EscrowProjectionSparkline({ data }: { data: EscrowProjectionPoint[] }) {
  if (!data || data.length === 0) {
    return <p className="text-sm text-slate-500">Projection unavailable.</p>;
  }

  const width = 280;
  const height = 120;
  const padding = 12;
  const balances = data.map((point) => point.balance);
  const max = Math.max(...balances, 1);
  const min = Math.min(...balances, 0);
  const stepX = (width - padding * 2) / Math.max(data.length - 1, 1);

  const points = data
    .map((point, index) => {
      const x = padding + index * stepX;
      const normalized = max === min ? 0.5 : (point.balance - min) / (max - min);
      const y = height - padding - normalized * (height - padding * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="w-full text-sky-500">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        points={points}
      />
      <line
        x1={padding}
        x2={width - padding}
        y1={height - padding}
        y2={height - padding}
        stroke="currentColor"
        strokeWidth={0.5}
        opacity={0.2}
      />
    </svg>
  );
}

function formatCurrency(value?: number | null) {
  const numeric = typeof value === "number" ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatPercent(value?: number | null, fractionDigits = 1) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString();
}

function formatStatus(value?: string | null) {
  if (!value) return "—";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function PortfolioOverview() {
    const [overview, setOverview] = useState<LenderOverview | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [selectedEscrowId, setSelectedEscrowId] = useState<string | number | null>(null);
  const [projection, setProjection] = useState<EscrowProjectionPoint[]>([]);
  const [reports, setReports] = useState<ReportSummarySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectionLoading, setProjectionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiScorecard, setAiScorecard] = useState<AiScorecard | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<string[]>([]);
  const [latestOrchestration, setLatestOrchestration] = useState<ApplicationOrchestration | null>(null);
  
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const orchestrationRequest = applicationsClient
          .listOrchestrations({ limit: 1 })
          .catch(() => [] as ApplicationOrchestration[]);
        const [
          overviewResult,
          appsResult,
          escrowResult,
          reportsResult,
          orchestrationsResult,
        ] = await Promise.all([
          getLenderOverview(),
          listApplications({ limit: 6 }),
          listUpcomingEscrows({ limit: 5 }),
          getReportSummary(),
          orchestrationRequest,
        ]);
        if (cancelled) return;
        setOverview(overviewResult);
        setApplications(appsResult);
        setEscrows(escrowResult);
        setReports(reportsResult);
        if (escrowResult.length > 0) {
          setSelectedEscrowId(escrowResult[0]?.loan_id ?? null);
        } else {
          setSelectedEscrowId(null);
        }
        const latest = orchestrationsResult?.[0] ?? null;
        setLatestOrchestration(latest ?? null);
        if (latest?.outputs?.scorecard) {
          setAiScorecard(latest.outputs.scorecard as AiScorecard);
          const baseRecommendations = latest.outputs.scorecard.recommendations ?? [];
          const fraudAlerts =
            latest.outputs?.fraud?.suspicious && latest.outputs?.fraud?.anomalies?.length
              ? [`Fraud watch: ${latest.outputs.fraud.anomalies.join('; ')}`]
              : [];
          setAiRecommendations([...fraudAlerts, ...baseRecommendations]);
        } else {
          setAiScorecard(null);
          setAiRecommendations([]);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError("Unable to load lender portfolio data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedEscrowId) {
      setProjection([]);
      return;
    }
    let cancelled = false;
    setProjectionLoading(true);
    getEscrowProjection(selectedEscrowId)
      .then((points) => {
        if (!cancelled) {
          setProjection(points);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setProjection([]);
      })
      .finally(() => {
        if (!cancelled) setProjectionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEscrowId]);

  const selectedEscrow = useMemo(
    () => escrows.find((entry) => String(entry.loan_id) === String(selectedEscrowId)) ?? null,
    [escrows, selectedEscrowId]
  );

  const collectionsSummary = useMemo(() => {
    if (reports?.collections) return reports.collections;
    if (overview?.collections) return overview.collections;
    return null;
  }, [overview, reports]);

    const aiSummary = useMemo(() => {
    if (!aiScorecard) return null;
    const adjustment = aiScorecard.adjustment ?? 0;
    const direction = adjustment >= 0 ? '↑' : '↓';
    const forecastLoss = aiScorecard.forecast?.expectedLossRate;
    const lossLabel =
      typeof forecastLoss === 'number' ? `${forecastLoss}% expected loss` : 'Loss forecast pending';
    return `${direction}${Math.abs(adjustment)}pt adjustment · ${lossLabel}`;
  }, [aiScorecard]);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-sm text-slate-500">
        Loading portfolio overview…
      </div>
    );
  }

  return (
    <div className="space-y-6">
     <header className="space-y-1">
        <h1 className="text-xl font-semibold text-slate-900">Lender portfolio overview</h1>
        <p className="text-sm text-slate-500">
          Consolidated production, collections, and escrow telemetry for your active organization.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          title="Active loans"
          value={overview ? overview.totals.totalLoans.toLocaleString() : "—"}
          caption="Aggregate across all programs"
        />
        <Kpi
          title="Delinquency rate"
          value={formatPercent(overview?.totals.delinquencyRate)}
          caption="30+ days past due"
        />
        <Kpi
          title="Avg. interest rate"
          value={formatPercent(overview?.totals.avgInterestRate)}
          caption="Weighted by outstanding principal"
        />
        <Kpi
          title="Outstanding principal"
          value={formatCurrency(overview?.totals.outstandingPrincipal)}
          caption="Across active positions"
        />
      </div>

     <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <section className="space-y-6 xl:col-span-3">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Recent applications</h3>
                <p className="text-xs text-slate-500">Latest borrower submissions across channels</p>
                       {aiSummary && (
                  <p className="mt-1 text-xs font-medium text-emerald-600">{aiSummary}</p>
                )}
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Applicant</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Submitted</th>
                  </tr>
                      </thead>
                <tbody className="divide-y divide-slate-100">
                  {applications.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-center text-slate-500" colSpan={4}>
                        No applications found.
                      </td>
                    </tr>
                  ) : (
                    applications.map((application) => (
                      <tr key={application.id ?? application.name} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-900">{application.name ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-700">{formatCurrency(application.amount)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {formatStatus(application.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{formatDate(application.submitted_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>        
          </div>

           <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Upcoming escrow obligations</h3>
                  <p className="text-xs text-slate-500">Select a loan to view its projection</p>
                </div>
              </header>
              <div className="max-h-[260px] divide-y divide-slate-100 overflow-y-auto">
                {escrows.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-slate-500">No escrow items scheduled.</p>
                ) : (
                  escrows.map((entry) => {
                    const loanId = entry.loan_id ?? entry.id;
                    const isActive = String(loanId) === String(selectedEscrowId);
                    return (
                      <button
                        key={loanId}
                        onClick={() => setSelectedEscrowId(loanId)}
                        className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition ${
                          isActive ? "bg-slate-100" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between text-sm text-slate-900">
                          <span>Loan #{loanId}</span>
                          <span className="font-medium">{formatCurrency(entry.projected_balance ?? entry.escrow_balance)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                          <span>Tax due {formatDate(entry.next_tax_due)}</span>
                          <span>Insurance due {formatDate(entry.next_insurance_due)}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

             <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Escrow burn projection</h3>
                  <p className="text-xs text-slate-500">
                    Loan {selectedEscrow ? `#${selectedEscrow.loan_id}` : "selection"}
                  </p>
                </div>
                {projectionLoading && (
                  <span className="text-xs text-slate-400">Loading…</span>
                )}
              </header>
              <div className="p-4">
                <EscrowProjectionSparkline data={projection} />
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div>
                    <div className="font-medium text-slate-500">Next tax due</div>
                    <div className="text-slate-900">{formatDate(selectedEscrow?.next_tax_due)}</div>
                  </div>
                  <div>
                    <div className="font-medium text-slate-500">Next insurance due</div>
                    <div className="text-slate-900">{formatDate(selectedEscrow?.next_insurance_due)}</div>
                  </div>
                  <div>
                    <div className="font-medium text-slate-500">Annual tax</div>
                    <div className="text-slate-900">{formatCurrency(selectedEscrow?.tax_amount)}</div>
                  </div>
                  <div>
                    <div className="font-medium text-slate-500">Annual insurance</div>
                    <div className="text-slate-900">{formatCurrency(selectedEscrow?.insurance_amount)}</div>
                  </div>
                </div>
              </div>
            </div>            
          </div>

                 <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">Collections summary</h3>
            </header>
            <div className="grid gap-4 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">MTD collected</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {formatCurrency(collectionsSummary?.monthToDateCollected)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Outstanding</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {formatCurrency(collectionsSummary?.outstanding)}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Delinquent loans</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {collectionsSummary ? collectionsSummary.delinquentCount : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Promises to pay</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">
                  {collectionsSummary ? collectionsSummary.promisesToPay : "—"}
                </div>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Last remittance posted</div>
                <div className="mt-1 text-sm text-slate-700">
                  {formatDate(collectionsSummary?.lastPaymentAt)}
                </div>
              </div>
            </div>
          </div>
       </section>
       
         <aside className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">AI recommendations</h3>
            {aiRecommendations.length > 0 ? (
              <ul className="space-y-2 text-xs text-slate-600">
                {aiRecommendations.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex items-start gap-2">
                    <span className="mt-[5px] h-1.5 w-1.5 flex-none rounded-full bg-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">
                Run an AI document review to surface tailored underwriting actions.
              </p>
            )}
            {latestOrchestration?.submitted_at && (
              <p className="mt-3 text-[11px] text-slate-400">
                Last reviewed {formatDate(latestOrchestration.submitted_at)}
              </p>
            )}
          </div>
          <NextDueCard />

           <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Reporting activity</h3>
            {reports?.recentReports && reports.recentReports.length > 0 ? (
              <ul className="space-y-2 text-sm text-slate-600">
                {reports.recentReports.map((report) => (
                  <li key={report.id} className="rounded border border-slate-100 px-3 py-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{formatDate(report.generated_at)}</span>
                      <span className="font-medium text-slate-600">{formatStatus(report.status)}</span>
                    </div>
                    <div className="mt-1 text-slate-900">{report.name ?? report.id}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No recent reports generated.</p>
            )}
            {reports?.summary && (
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
                <div>
                  <div className="font-semibold text-slate-900">{reports.summary.scheduled}</div>
                  <div>Scheduled</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{reports.summary.saved}</div>
                  <div>Saved templates</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{reports.summary.totalRuns}</div>
                  <div>Total runs</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">
                    {formatDate(reports.summary.lastRunAt) || "—"}
                  </div>
                  <div>Last run</div>
                </div>
              </div>
            )}
          </div>
         </aside>
      </div>
    </div>
  );
}
