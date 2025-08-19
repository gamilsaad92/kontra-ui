import { useEffect, useState } from "react";
import { getRiskSummary, getPortfolioSnapshot, getRoiSeries } from "../../services/analytics";
import { DonutChart } from "../../shared/DonutChart";
import { MiniLine } from "../../shared/MiniLine";

export default function PortfolioOverview() {
  const [snapshot, setSnapshot] = useState<{delinqPct:number, points:number[]}|null>(null);
  const [risk, setRisk] = useState<{buckets:{label:string; value:number}[]}|null>(null);
  const [roi, setRoi] = useState<number[]|null>(null);

  useEffect(() => {
    Promise.all([getPortfolioSnapshot(), getRiskSummary(), getRoiSeries()])
      .then(([s, r, rs]) => { setSnapshot(s); setRisk(r); setRoi(rs); })
      .catch(() => {});
  }, []);

  return (
    <div className="grid gap-5">
      {/* Row 1: 3 cards */}
      <div className="grid md:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="font-semibold mb-3">Portfolio Snapshot</h3>
          <div className="text-3xl font-semibold">{snapshot?.delinqPct?.toFixed(2)}%</div>
          <div className="opacity-70 text-sm mt-1">Delinquency %</div>
          <div className="mt-4"><MiniLine points={snapshot?.points ?? []}/></div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="font-semibold mb-3">Risk Exposure</h3>
          <DonutChart data={risk?.buckets ?? []}/>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="font-semibold mb-3">ROI Trends</h3>
          <MiniLine points={roi ?? []}/>
        </div>
      </div>

      {/* Row 2: tables */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Loan Pipeline</h3>
            <a className="text-xs opacity-70 hover:opacity-100" href="/lender/pipeline">View all</a>
          </div>
          <PipelineTable/>
        </div>

        <div className="grid gap-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="font-semibold mb-3">Draw Requests</h3>
            <DrawRequestsTable/>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="font-semibold mb-3">Send Payoff Quote</h3>
            <PayoffQuickForm/>
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelineTable(){return <div className="text-sm opacity-80">…</div>;}
function DrawRequestsTable(){return <div className="text-sm opacity-80">…</div>;}
function PayoffQuickForm(){return <div className="text-sm opacity-80">…</div>;}
