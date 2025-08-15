import React, { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Download,
  Filter,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sparkles,
  User,
} from "./icons";

async function getKpis(role) {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          primary: [
            { label: role === "investor" ? "Yield" : "Active Loans", value: role === "investor" ? "7.8%" : "124" },
            { label: role === "lender" ? "Delinquency" : "Exposure", value: role === "lender" ? "1.6%" : "$12.3M" },
            { label: role === "borrower" ? "Next Due" : "DSCR", value: role === "borrower" ? "09/01" : "1.21x" },
          ],
          alerts: [
            { type: "risk", text: "3 loans trending to delinquent", severity: "high" },
            { type: "ops", text: "5 draw requests awaiting approval", severity: "med" },
          ],
        }),
      400
    )
  );
}

async function getChartData(role) {
  return new Promise((r) =>
    setTimeout(
      () =>
        r([
          { name: "Jan", a: 12, b: 8 },
          { name: "Feb", a: 18, b: 12 },
          { name: "Mar", a: 16, b: 10 },
          { name: "Apr", a: 22, b: 15 },
          { name: "May", a: 19, b: 14 },
          { name: "Jun", a: 24, b: 18 },
        ]),
      480
    )
  );
}

async function getTableRows(role) {
  return new Promise((r) =>
    setTimeout(
      () =>
        r([
          { id: "LN-1021", name: "Mulberry Creek", status: "Pending KYC", amount: 450000, date: "2025-08-02" },
          { id: "LN-1022", name: "Haniston Plaza", status: "Approved", amount: 1200000, date: "2025-08-05" },
          { id: "LN-1023", name: "Pork Stugton Park", status: "Funded", amount: 900000, date: "2025-08-12" },
        ]),
      520
    )
  );
}

function SectionTitle({ children }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-lg font-semibold tracking-tight text-slate-100/90">{children}</h3>
    </div>
  );
}

function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <Card className="border border-slate-800/60 bg-slate-900/40">
      <CardContent className="py-12 text-center">
        <Sparkles className="mx-auto mb-3" aria-hidden />
        <h4 className="text-slate-100 font-medium mb-1">{title}</h4>
        <p className="text-slate-400 mb-4 max-w-md mx-auto">{description}</p>
        {actionLabel && (
          <Button variant="secondary" onClick={onAction} aria-label={actionLabel}>
            {actionLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <Card className="border border-red-900/40 bg-red-950/30">
      <CardContent className="py-10 text-center">
        <AlertTriangle className="mx-auto mb-2" aria-hidden />
        <p className="text-red-200 mb-4">{message}</p>
        {onRetry && <Button onClick={onRetry}>Retry</Button>}
      </CardContent>
    </Card>
  );
}

function QuickActions({ role }) {
  const items = useMemo(() => {
    switch (role) {
      case "lender":
        return ["Create Loan", "Approve Draw", "Send Payoff Quote", "Generate Report"];
      case "investor":
        return ["Export Report", "Set Alert Thresholds", "Download Statement"];
      case "borrower":
        return ["Request Payoff Quote", "Submit Draw Request", "Upload Document"];
      case "contractor":
        return ["Upload Invoice", "Request Inspection", "View Funding Schedule"];
      case "admin":
        return ["Add User", "Update Branding", "View Audit Log", "Configure Workflow"];
      default:
        return [];
    }
    }, [role]);

  return (
    <Card className="border border-slate-800/60 bg-slate-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-300">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((label) => (
          <Button key={label} variant="secondary" className="justify-start" aria-label={label}>
            {label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}

function KpiRow({ kpis }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {kpis.map((k) => (
        <Card key={k.label} className="border border-slate-800/60 bg-slate-900/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-400">{k.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-100">{k.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AlertsRow({ alerts }) {
  const badge = (sev) =>
    ({
      low: "bg-emerald-900/40 text-emerald-200 border-emerald-700/40",
      med: "bg-amber-900/40 text-amber-200 border-amber-700/40",
      high: "bg-rose-900/40 text-rose-200 border-rose-700/40",
    }[sev]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {alerts.map((a, i) => (
        <Card
          key={i}
          className={`border ${a.severity === "high" ? "border-rose-800/50" : "border-slate-800/60"} bg-slate-900/40`}
        >
          <CardContent className="py-4 flex items-center gap-3">
            {a.type === "risk" ? <AlertTriangle aria-hidden /> : <Bell aria-hidden />}
            <span className="text-slate-200">{a.text}</span>
            <span className={`ml-auto rounded-full border px-2 py-0.5 text-xs ${badge(a.severity)}`}>
              {a.severity.toUpperCase()}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartPanel({ data, variant = "line", title = "Trends" }) {
  return (
    <Card className="border border-slate-800/60 bg-slate-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-300">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {variant === "line" ? (
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeOpacity={0.1} />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <RTooltip />
              <Line type="monotone" dataKey="a" stroke="#60a5fa" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="b" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeOpacity={0.1} />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <RTooltip />
              <Bar dataKey="a" fill="#60a5fa" />
              <Bar dataKey="b" fill="#34d399" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function TablePanel({ rows, title = "Loan Pipeline" }) {
  return (
    <Card className="border border-slate-800/60 bg-slate-900/40">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm text-slate-300">{title}</CardTitle>
        <div className="flex items-center gap-2">
          <Input placeholder="Search" className="h-8 w-40" aria-label="Search table" />
          <Button size="sm" variant="secondary">
            <Filter className="mr-1 h-4 w-4" />
            Filters
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-400 border-b border-slate-800/60">
            <tr>
              <th className="text-left py-2 pr-4 font-medium">ID</th>
              <th className="text-left py-2 pr-4 font-medium">Name</th>
              <th className="text-left py-2 pr-4 font-medium">Status</th>
              <th className="text-right py-2 pl-4 font-medium">Amount</th>
              <th className="text-right py-2 pl-4 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-slate-800/40 hover:bg-slate-800/30 focus-within:bg-slate-800/30"
              >
                <td className="py-2 pr-4 text-slate-200">{r.id}</td>
                <td className="py-2 pr-4 text-slate-200">{r.name}</td>
                <td className="py-2 pr-4">
                  <Badge variant="secondary">{r.status}</Badge>
                </td>
                <td className="py-2 pl-4 text-right text-slate-200">${" "}{r.amount.toLocaleString()}</td>
                <td className="py-2 pl-4 text-right text-slate-400">{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function NotificationsSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open notifications">
          <Bell />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-96 bg-slate-950 text-slate-200 border-slate-800">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5" />
            <div>
              <div className="text-sm">Report generated</div>
              <div className="text-xs text-slate-400">2 minutes ago</div>
            </div>
          </div>
                <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5" />
            <div>
              <div className="text-sm">Loan LN-1021 at risk</div>
              <div className="text-xs text-slate-400">1 hour ago</div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RoleTabs({ role, onChange }) {
  return (
    <Tabs value={role} onValueChange={onChange} className="w-full">
      <TabsList className="grid grid-cols-5 bg-slate-900 border border-slate-800/60">
        <TabsTrigger value="lender">Lender/Servicer</TabsTrigger>
        <TabsTrigger value="investor">Investor</TabsTrigger>
        <TabsTrigger value="borrower">Borrower</TabsTrigger>
        <TabsTrigger value="contractor">Contractor</TabsTrigger>
        <TabsTrigger value="admin">Admin</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function LenderView() {
  const [kpis, setKpis] = useState(null);
  const [rows, setRows] = useState(null);
  const [data, setData] = useState(null);
  useEffect(() => {
    getKpis("lender").then(setKpis);
    getTableRows("lender").then(setRows);
    getChartData("lender").then(setData);
  }, []);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        {!kpis ? <Skeleton className="h-24 w-full" /> : <KpiRow kpis={kpis.primary} />}
        {!data ? <Skeleton className="h-56 w-full" /> : <ChartPanel data={data} title="Portfolio & DSCR Trends" />}
        {!rows ? <Skeleton className="h-64 w-full" /> : <TablePanel rows={rows} title="Loan Pipeline" />}
        {kpis && <AlertsRow alerts={kpis.alerts} />}
      </div>
      <div className="space-y-4">
        <QuickActions role="lender" />
        <EmptyState
          title="5 draw requests pending"
          description="Review documentation and approve releases. You can bulk approve from the Draws queue."
          actionLabel="Open Draw Queue"
          onAction={() => {}}
        />
      </div>
    </div>
  );
}

function InvestorView() {
  const [kpis, setKpis] = useState(null);
  const [data, setData] = useState(null);
  useEffect(() => {
    getKpis("investor").then(setKpis);
    getChartData("investor").then(setData);
  }, []);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        {!kpis ? <Skeleton className="h-24 w-full" /> : <KpiRow kpis={kpis.primary} />}
        {!data ? <Skeleton className="h-56 w-full" /> : <ChartPanel data={data} variant="bar" title="ROI & Exposure" />}
        <EmptyState
          title="No new reports"
          description="Generate a quarterly PDF performance report for your LPs."
          actionLabel="Generate Report"
          onAction={() => {}}
        />
      </div>
      <div className="space-y-4">
        <QuickActions role="investor" />
        <Card className="border border-slate-800/60 bg-slate-900/40">
          <CardContent className="py-6 text-sm text-slate-300">
            Set risk alert thresholds to get notified when DSCR falls below 1.10x or delinquency &gt; 2%.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BorrowerView() {
  const [kpis, setKpis] = useState(null);
  const [rows, setRows] = useState(null);
  useEffect(() => {
    getKpis("borrower").then(setKpis);
    getTableRows("borrower").then(setRows);
  }, []);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        {!kpis ? <Skeleton className="h-24 w-full" /> : <KpiRow kpis={kpis.primary} />}
        {!rows ? <Skeleton className="h-64 w-full" /> : <TablePanel rows={rows} title="Draw Requests" />}
      </div>
      <div className="space-y-4">
        <QuickActions role="borrower" />
        <EmptyState
          title="Need a payoff quote?"
          description="Request a 10‑day payoff good‑through date. Fees and escrow will be calculated automatically."
          actionLabel="Request Payoff"
          onAction={() => {}}
        />
      </div>
    </div>
  );
}

function ContractorView() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        <EmptyState
          title="No invoices yet"
          description="Upload your first invoice and lien waiver. We’ll validate docs and notify the lender for approval."
          actionLabel="Upload Invoice"
          onAction={() => {}}
        />
      </div>
      <div className="space-y-4">
        <QuickActions role="contractor" />
      </div>
    </div>
  );
}

function AdminView() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        <EmptyState
          title="No users yet"
          description="Add your first user and assign a role. You can invite via email and enforce MFA."
          actionLabel="Add User"
          onAction={() => {}}
        />
      </div>
      <div className="space-y-4">
        <QuickActions role="admin" />
      </div>
    </div>
  );
}

export default function DashboardLayout({ role: initialRole = "lender", orgName = "Kontra", userName = "User" }) {
  const [role, setRole] = useState(initialRole);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
        <div className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-slate-950/70 bg-slate-950/60 border-b border-slate-800/60">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-2">
            <div className="flex items-center gap-2 mr-2">
              <div className="h-7 w-7 rounded-xl bg-sky-400/20 ring-1 ring-sky-400/30 grid place-items-center font-bold">K</div>
              <span className="font-semibold tracking-tight text-slate-100/90">{orgName}</span>
            </div>

            <div className="hidden md:flex items-center gap-2 ml-2">
              <RoleTabs role={role} onChange={setRole} />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  aria-label="Search anything"
                  placeholder="Search loans, borrowers, docs…"
                  className="pl-8 w-64 bg-slate-900/60 border-slate-800/60"
                />
              </div>
              <Button variant="ghost" size="icon" aria-label="Settings">
                <Settings />
              </Button>
              <NotificationsSheet />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" className="gap-2" aria-label="User menu">
                    <User className="h-4 w-4" />
                    {userName}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Organization Settings</DropdownMenuItem>
                  <DropdownMenuItem>Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-4">
          <div className="md:hidden">
            <RoleTabs role={role} onChange={setRole} />
          </div>

          {role === "lender" && <LenderView />}
          {role === "investor" && <InvestorView />}
          {role === "borrower" && <BorrowerView />}
          {role === "contractor" && <ContractorView />}
          {role === "admin" && <AdminView />}

          <div className="text-xs text-slate-500 pt-6">
            UI kit: Tailwind + shadcn/ui • Charts: Recharts • Built for accessibility and performance
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
