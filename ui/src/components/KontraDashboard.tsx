import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
 Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  MoreHorizontal,
  Search,
    Download,
  UploadCloud,
  FileText,
  DollarSign,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

/**
 * Kontra Multi‑Role Dashboard (single‑file)
 * ------------------------------------------------------------
 * - Four role views: Lender/Servicer, Investor, Borrower, Contractor/Developer
 * - Tailwind + shadcn/ui + framer‑motion
 * - Minimal SVG micro‑charts (no external chart lib required)
 * - API wiring hooks with graceful mock fallbacks
 *
 * Usage:
*   export default function App() { return <KontraDashboard apiBase={import.meta.env.VITE_API_BASE_URL} /> }
 *
 * Expected backend endpoints (override via props if different):
 *   GET /api/portfolio/overview
 *   GET /api/loans/pipeline
 *   GET /api/draw-requests?role=...
 *   GET /api/messages?role=...
 *   GET /api/projects/:projectId (for contractor progress)
 */

// ---------- Types ----------

type Loan = {
  id: string;
  borrower: string;
  status: string;
  stage?: string;
  address?: string;
};

type DrawRequest = {
  id: string;
  date: string; // ISO
  status: "Submitted" | "Funded" | "Pending" | string;
  fees?: number;
};

type PortfolioOverview = {
  defrequencyPct: number; // "Defriquency %" from the mock
  roiSeries: number[]; // tiny sparkline
  riskBuckets: { label: string; value: number }[]; // donut slices
};

type Message = { id: string; subject: string; created_at: string };

// ---------- Utilities ----------

const fallbackWait = (ms = 420) => new Promise((r) => setTimeout(r, ms));

function useApi<T>(url?: string, fallback?: T) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!url) throw new Error("No URL");
       const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const j = (await res.json()) as T;
        if (!cancelled) setData(j);
      } catch (e: any) {
        // Graceful fallback
        if (!cancelled && fallback) {
          await fallbackWait();
          setData(fallback);
        } else if (!cancelled) {
          setError(e?.message || "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);
  return { data, loading, error } as const;
}

function classNames(...arr: (string | false | null | undefined)[]) {
  return arr.filter(Boolean).join(" ");
}

// ---------- Micro Charts ----------

function MiniLineChart({ values }: { values: number[] }) {
  // Simple sparkline SVG
  const width = 180;
  const height = 48;
  const padding = 6;
  const path = useMemo(() => {
    if (!values?.length) return "";
    const max = Math.max(...values);
    const min = Math.min(...values);
    const norm = (v: number) =>
      height - padding - ((v - min) / (max - min || 1)) * (height - padding * 2);
    const step = (width - padding * 2) / (values.length - 1);
    return values
      .map((v, i) => `${i === 0 ? "M" : "L"}${padding + i * step},${norm(v)}`)
      .join(" ");
  }, [values]);
  return (
    <svg width={width} height={height} className="w-full">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={2} />
    </svg>
  );   
}

function Donut({
  buckets,
  size = 120,
  stroke = 12,
}: {
  buckets: { label: string; value: number }[];
  size?: number;
  stroke?: number;
}) {
  const total = Math.max(1, buckets.reduce((a, b) => a + (b.value || 0), 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`translate(${size / 2} ${size / 2})`}>
        {buckets.map((b, i) => {
          const frac = (b.value || 0) / total;
          const len = frac * circumference;
          const circle = (
            <circle
              key={b.label + i}
              r={radius}
              cx={0}
              cy={0}
              stroke="currentColor"
              strokeWidth={stroke}
              strokeDasharray={`${len} ${circumference - len}`}
              strokeDashoffset={-offset}
              fill="transparent"
            />
          );
          offset += len;
          return circle;
        })}
      </g>
    </svg>
  );
}

// ---------- Widgets ----------

function Header({ role }: { role: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3">
        <div className="text-2xl font-semibold tracking-tight">Kontra</div>
        <Badge variant="outline" className="rounded-full">{role}</Badge>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 opacity-70" />
          <Input className="pl-8 w-48" placeholder="Search" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Support</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function KpiCard({ title, value, footer, children }: { title: string; value?: string; footer?: string; children?: React.ReactNode }) {
  return (
   <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {value && <div className="text-3xl font-semibold mb-2">{value}</div>}
        {children}
        {footer && (
          <div className="text-xs text-muted-foreground mt-3">{footer}</div>
        )}
      </CardContent>
    </Card>  
  );
}

function QuickActions({ actions }: { actions: { label: string; href?: string; onClick?: () => void; icon?: React.ReactNode }[] }) {
  return (
     <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {actions.map((a, idx) => (
          <Button key={idx} variant="outline" className="justify-between" asChild={!!a.href} onClick={a.onClick}>
            {a.href ? (
              <a href={a.href}>
                <div className="flex items-center gap-2">{a.icon}{a.label}</div>
              </a>
            ) : (
              <div className="flex items-center gap-2">{a.icon}{a.label}</div>
            )}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function DataTable<T extends object>({ columns, rows }: { columns: { key: keyof T; label: string; className?: string }[]; rows: T[] }) {
  return (
      <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">Table</CardTitle>
      </CardHeader>
       <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={String(c.key)} className={c.className}>{c.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any, i) => (
              <TableRow key={i}>
                {columns.map((c) => (
                  <TableCell key={String(c.key)} className={c.className}>
                    {String(r[c.key] ?? "—")}
                  </TableCell>
                ))}
              </TableRow>  
            ))}
         </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ---------- Lender / Servicer View ----------

function LenderServicerView({ apiBase }: { apiBase: string }) {
  const overviewUrl = `${apiBase}/portfolio/overview`;
  const pipelineUrl = `${apiBase}/loans/pipeline`;
  const drawUrl = `${apiBase}/draw-requests?role=lender`;

  const { data: overview } = useApi<PortfolioOverview>(overviewUrl, {
    defrequencyPct: 1.24,
    roiSeries: [8, 9, 8.5, 9.2, 9.4, 9.1, 9.7, 10.2, 10.5],
    riskBuckets: [
      { label: "Low", value: 55 },
      { label: "Medium", value: 32 },
      { label: "High", value: 13 },
    ],
  });

  const { data: pipeline } = useApi<Loan[]>(pipelineUrl, [
    { id: "1", borrower: "West Lay Bank", status: "Pending KYC", stage: "Approved" },
    { id: "2", borrower: "Apple Park Apts", status: "Appointed", stage: "Appraised" },
    { id: "3", borrower: "Hanniton Storage", status: "Approved", stage: "A2S to Doc" },
    { id: "4", borrower: "Port Stugton Park", status: "Submitted", stage: "Funded" },
    { id: "5", borrower: "Mulberry Creek", status: "Funded", stage: "Funded" },
  ]);

  const { data: drawRequests } = useApi<DrawRequest[]>(drawUrl, [
    { id: "d1", date: "2020-08-08", status: "Submitted" },
    { id: "d2", date: "2020-04-22", status: "Submitted" },
    { id: "d3", date: "2020-06-22", status: "Funded" },
  ]);

  return (
      <div className="grid grid-cols-12 gap-4">
      {/* Portfolio Overview */}
      <div className="col-span-12">
        <div className="text-sm text-muted-foreground mb-2">Portfolio Overview</div>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-4">
            <KpiCard title="Portfolio Snapshot" value={`${overview?.defrequencyPct?.toFixed(2)} %`} footer="Defriquency %">
              <MiniLineChart values={overview?.roiSeries || []} />
            </KpiCard>  
          </div>
                  <div className="col-span-12 md:col-span-4">
            <KpiCard title="Risk Exposure">
              <div className="flex items-center gap-4">
                <Donut buckets={overview?.riskBuckets || []} />
                <div className="space-y-1 text-sm">
                  {(overview?.riskBuckets || []).map((b) => (
                    <div key={b.label} className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-foreground/60" />
                      <span className="text-muted-foreground w-16">{b.label}</span>
                      <span className="font-medium">{b.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </KpiCard>
          </div>
          <div className="col-span-12 md:col-span-4">
            <KpiCard title="ROI Trends">
              <MiniLineChart values={overview?.roiSeries || []} />
            </KpiCard>
          </div>
        </div>
      </div>

      {/* Loan Pipeline & Draw Requests */}
      <div className="col-span-12 md:col-span-7">
        <Card className="shadow-sm h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground">Loan Pipeline</CardTitle>
              <Button variant="ghost" size="sm" className="gap-1">
                Send Payoff Quote <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Borrower Name</TableHead>
                  <TableHead>Application Status</TableHead>
                  <TableHead>Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pipeline || []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.borrower}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.stage || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>        

      <div className="col-span-12 md:col-span-5">
        <Card className="shadow-sm h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Draw Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(drawRequests || []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{new Date(d.date).toLocaleDateString()}</TableCell>
                    <TableCell>{d.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
  
      {/* Quick Actions */}
      <div className="col-span-12">
        <QuickActions
          actions={[
            { label: "Request Payoff Quote", href: "/payoffs/new", icon: <DollarSign className="h-4 w-4" /> },
            { label: "Submit Draw Request", href: "/draws/new", icon: <UploadCloud className="h-4 w-4" /> },
            { label: "Upload Document", href: "/documents/upload", icon: <FileText className="h-4 w-4" /> },
          ]}
        />
      </div>
    </div>
  );
}

// ---------- Investor View ----------

function InvestorView({ apiBase }: { apiBase: string }) {
  const { data: overview } = useApi<PortfolioOverview>(`${apiBase}/portfolio/overview`, {
    defrequencyPct: 1.24,
    roiSeries: [7.5, 7.7, 7.9, 8.1, 8.2, 8.6, 8.9, 9.3],
    riskBuckets: [
      { label: "AAA", value: 40 },
      { label: "AA", value: 30 },
      { label: "A", value: 20 },
      { label: "BBB", value: 10 },
    ],
  });

  const { data: pipeline } = useApi<Loan[]>(`${apiBase}/loans/pipeline?view=investor`, [
    { id: "i1", borrower: "Cedar Oaks", status: "Open", stage: "On‑Market" },
    { id: "i2", borrower: "Maple Ridge", status: "Closed", stage: "Settled" },
  ]);

  return (
     <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12">
        <div className="text-sm text-muted-foreground mb-2">Portfolio Overview</div>
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-4">
            <KpiCard title="Portfolio Snapshot" value={`${overview?.defrequencyPct?.toFixed(2)} %`} footer="Defriquency %">
              <MiniLineChart values={overview?.roiSeries || []} />
            </KpiCard>
          </div>
          <div className="col-span-12 md:col-span-4">
            <KpiCard title="Risk Exposure">
              <Donut buckets={overview?.riskBuckets || []} />
            </KpiCard>
          </div>
          <div className="col-span-12 md:col-span-4">
            <KpiCard title="ROI Trends">
              <MiniLineChart values={overview?.roiSeries || []} />
            </KpiCard>
          </div>
        </div>
      </div>

      <div className="col-span-12">
        <Card className="shadow-sm h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground">Lean Pipeline</CardTitle>
              <Button variant="ghost" size="sm" className="gap-1">
                Export <Download className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pipeline || []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.borrower}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.stage || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    
     <div className="col-span-12">
        <QuickActions
          actions={[
            { label: "Create Allocation", href: "/investor/allocations/new", icon: <DollarSign className="h-4 w-4" /> },
            { label: "View Reports & Analytics", href: "/reports", icon: <FileText className="h-4 w-4" /> },
          ]}
        />

      </div>
    </div>
  );
}
// ---------- Borrower View ----------

function BorrowerView({ apiBase }: { apiBase: string }) {
  const { data: draws } = useApi<DrawRequest[]>(`${apiBase}/draw-requests?role=borrower`, [
    { id: "b1", date: "2020-08-08", status: "Submitted" },
    { id: "b2", date: "2020-04-22", status: "Submitted" },
    { id: "b3", date: "2020-06-22", status: "Funded" },
  ]);

  const { data: messages } = useApi<Message[]>(`${apiBase}/messages?role=borrower`, [
    { id: "m1", subject: "Upload Invoice", created_at: new Date().toISOString() },
    { id: "m2", subject: "Request Inspection", created_at: new Date().toISOString() },
  ]);

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 md:col-span-6">
        <KpiCard title="Loan Summary" value="$250,000" footer="Interest Rate  •  Payoff Date 18/15/0626">
          <div className="flex items-center gap-2 mt-2">
            <Button variant="outline" className="gap-2" asChild>
              <a href="/payments">Payment History</a>
            </Button>
            <Button variant="ghost" className="gap-1" asChild>
              <a href="/loan/updates">Updates <ChevronDown className="h-4 w-4" /></a>
            </Button>
          </div>
        </KpiCard>
      </div>
  
      <div className="col-span-12 md:col-span-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Draw Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(draws || []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{new Date(d.date).toLocaleDateString()}</TableCell>
                    <TableCell>{d.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
   
      <div className="col-span-12 md:col-span-6">
        <QuickActions
          actions={[
            { label: "Upload Invoice", href: "/borrower/invoices/upload", icon: <UploadCloud className="h-4 w-4" /> },
            { label: "Request Inspection", href: "/borrower/inspections/new", icon: <FileText className="h-4 w-4" /> },
          ]}
        />
      </div>
    
      <div className="col-span-12 md:col-span-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(messages || []).map((m) => (
                  <li key={m.id} className="flex items-center justify-between">
                    <span>{m.subject}</span>
                    <span className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
      </div>
    </div>
  );
}

// ---------- Contractor / Developer View ----------

function ContractorDeveloperView({ apiBase }: { apiBase: string }) {
  const { data: progress } = useApi<{ percent: number }>(`${apiBase}/projects/current/progress`, { percent: 76 });
  const { data: schedule } = useApi<{ funded: number; total: number }>(`${apiBase}/projects/current/funding`, { funded: 8503, total: 46553 });

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground">Project Progress</CardTitle>
              <div className="text-xs text-muted-foreground">{progress?.percent ?? 0}%</div>  
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={progress?.percent ?? 0} className="h-2" />
          </CardContent>
        </Card>
      </div>

           <div className="col-span-12 md:col-span-7">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Funding Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-xl border">
                <div className="text-muted-foreground">Funding Schedule</div>
                <div className="text-2xl font-semibold mt-1">{schedule?.funded?.toLocaleString?.() ?? schedule?.funded} / {schedule?.total?.toLocaleString?.() ?? schedule?.total}</div>
              </div>
              <div className="p-3 rounded-xl border">
                <div className="text-muted-foreground">Alerts</div>
                <div className="text-sm mt-2">No active alerts.</div>
              </div>
            </div>
                  </CardContent>
        </Card>
      </div>

      <div className="col-span-12 md:col-span-5">
        <QuickActions
          actions={[
            { label: "Request Payoff Quote", href: "/payoffs/new", icon: <DollarSign className="h-4 w-4" /> },
            { label: "Submit Draw Request", href: "/draws/new", icon: <UploadCloud className="h-4 w-4" /> },
            { label: "Upload Document", href: "/documents/upload", icon: <FileText className="h-4 w-4" /> },
          ]}
        />
      </div>
    </div>
  );
}

// ---------- Main Container ----------

type KontraDashboardProps = {
  apiBase?: string; // e.g., "/api" or your full origin for the Express+Supabase backend
  initialRole?: "lender" | "investor" | "borrower" | "contractor";
};

export default function KontraDashboard({ apiBase = "/api", initialRole = "lender" }: KontraDashboardProps) {
  return (
    <div className="min-h-screen w-full bg-background text-foreground p-4 md:p-6">
      <Tabs defaultValue={initialRole} className="w-full">
        <div className="flex items-center justify-between">
          <Header role="Dashboard" />
          <TabsList className="grid grid-cols-4 gap-2">
            <TabsTrigger value="lender">Lender / Servicer</TabsTrigger>
            <TabsTrigger value="investor">Investor</TabsTrigger>
            <TabsTrigger value="borrower">Borrower</TabsTrigger>
            <TabsTrigger value="contractor">Contractor / Developer</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="lender" className="mt-4">
          <LenderServicerView apiBase={apiBase} />
        </TabsContent>
        <TabsContent value="investor" className="mt-4">
          <InvestorView apiBase={apiBase} />
        </TabsContent>
        <TabsContent value="borrower" className="mt-4">
          <BorrowerView apiBase={apiBase} />
        </TabsContent>
        <TabsContent value="contractor" className="mt-4">
          <ContractorDeveloperView apiBase={apiBase} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
