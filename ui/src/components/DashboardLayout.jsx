import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Filter,
  Search,
  Settings,
  User,
  Download,
} from "./icons";

/**
 * ------------------------------------------------------------
 *  Kontra Dashboard — pixel‑matched to reference layout
 *  - Role tabs across the top
 *  - Role‑specific subnav beneath app bar (matches screenshot)
 *  - Section blocks & card layout per role
 *  - Tight, dark UI with high contrast and subtle borders
 * ------------------------------------------------------------
 */

const riskDonutData = [
  { name: "Current", value: 58 },
  { name: "30+", value: 22 },
  { name: "60+", value: 12 },
  { name: "90+", value: 8 },
];

const donutPalette = ["#94a3b8", "#60a5fa", "#34d399", "#f59e0b"]; // slate, sky, emerald, amber

async function getKpis(role) {
  const { data, error } = await supabase.rpc("get_kpis", { role });
  if (error || !data) throw error || new Error("Failed to load KPIs");
  return data;
}

async function getChartData(role) {
  const { data, error } = await supabase.rpc("get_chart_data", { role });
  if (error || !data) throw error || new Error("Failed to load chart data");
  return data;
}

async function getTableRows(role) {
  const { data, error } = await supabase
    .from("dashboard_rows")
    .select("id,name,status,amount,date")
    .eq("role", role);
  if (error || !data) throw error || new Error("Failed to load dashboard rows");
  return data;
}

function AppHeader({ orgName, role, onRoleChange, userName }) {
  return (
    <div className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80 bg-slate-950/60 border-b border-slate-800/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-2">
        <div className="flex items-center gap-2 mr-2">
          <div className="h-7 w-7 rounded-xl bg-sky-400/20 ring-1 ring-sky-400/30 grid place-items-center font-bold">K</div>
          <span className="font-semibold tracking-tight text-slate-100/90">{orgName}</span>
        </div>

        <div className="hidden md:flex items-center gap-2 ml-2">
          <RoleTabs role={role} onChange={onRoleChange} />
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

      {/* role-specific subnav bar (matches screenshot) */}
      <div className="border-t border-slate-800/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-10 flex items-center gap-4 overflow-x-auto">
          <RoleSubnav role={role} />
        </div>
      </div>
    </div>
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

function RoleSubnav({ role }) {
  const items = {
    lender: ["Portfolio Overview", "Loan Pipeline", "Servicing Center", "Draw Requests", "Reports & Analytics"],
    investor: ["Portfolio Overview", "Lean Pipeline", "Servicing Center", "Draw Requests", "Reports & Analytics"],
    borrower: ["Loan Summary", "Draw Requests"],
    contractor: ["Project Progress", "Funding Schedule", "Documents"],
    admin: ["Users", "Branding", "Audit", "Workflows"],
  }[role];

  return (
    <div className="flex items-center gap-6 text-sm">
      {items?.map((label, idx) => (
        <div
          key={label}
          className={`whitespace-nowrap ${idx === 0 ? "text-slate-100" : "text-slate-400"}`}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-lg font-semibold tracking-tight text-slate-100/90">{children}</h3>
    </div>
  );
}

function QuickActions({ items }) {
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

function DonutPanel({ title = "Risk Exposure" }) {
  return (
    <Card className="border border-slate-800/60 bg-slate-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-300">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-56 grid place-items-center">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={riskDonutData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={70}>
              {riskDonutData.map((_, i) => (
                <Cell key={i} fill={donutPalette[i % donutPalette.length]} />
              ))}
            </Pie>
            <RTooltip />
          </PieChart>
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
              <th className="text-left py-2 pr-4 font-medium">Borrower Name</th>
              <th className="text-left py-2 pr-4 font-medium">Application Status</th>
              <th className="text-left py-2 pr-4 font-medium">Assignee</th>
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
                <td className="py-2 pr-4 text-slate-200">{r.name}</td>
                <td className="py-2 pr-4">
                  <Badge variant="secondary">{r.status}</Badge>
                </td>
                <td className="py-2 pr-4 text-slate-400">Team</td>
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

function FundingScheduleCard() {
  return (
    <Card className="border border-slate-800/60 bg-slate-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-300">Funding Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between"><span className="text-slate-400">Funding Schedule</span><span className="text-slate-200">8503/455533</span></div>
        <div className="flex items-center justify-between"><span className="text-slate-400">Alerts</span><span className="text-slate-200">2</span></div>
        <Button variant="secondary" size="sm" className="w-full"><Download className="h-4 w-4 mr-2"/>Export</Button>
      </CardContent>
    </Card>
  );
}

function MessagesCard() {
  return (
    <Card className="border border-slate-800/60 bg-slate-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-300">Messages</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <Button variant="secondary" className="w-full justify-between">Upload Invoice<span className="text-xs text-slate-400">›</span></Button>
        <Button variant="secondary" className="w-full justify-between">Request Inspection<span className="text-xs text-slate-400">›</span></Button>
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

/** Views */
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!data ? <Skeleton className="h-56 w-full" /> : <ChartPanel data={data} title="ROI Trends" />}
          <DonutPanel />
        </div>
        {!rows ? <Skeleton className="h-64 w-full" /> : <TablePanel rows={rows} title="Loan Pipeline" />}
        {kpis && <AlertsRow alerts={kpis.alerts} />}
      </div>
      <div className="space-y-4">
        <QuickActions items={["Create Loan", "Approve Draw", "Send Payoff Quote", "Generate Report"]} />
        <Card className="border border-slate-800/60 bg-slate-900/40">
          <CardContent className="py-6 text-center text-sm text-slate-300">5 draw requests pending</CardContent>
        </Card>
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
        <Card className="border border-slate-800/60 bg-slate-900/40">
          <CardContent className="py-6 text-center text-sm text-slate-300">No new reports</CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <QuickActions items={["Export Report", "Set Alert Thresholds", "Download Statement"]} />
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
        {!kpis ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border border-slate-800/60 bg-slate-900/40">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">Loan Summary</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-2xl font-semibold text-slate-100">$250,000</div>
                  <div className="text-slate-400">Interest Rate</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-slate-100">18/05/2026</div>
                  <div className="text-slate-400">Payoff Date</div>
                </div>
                <Button variant="secondary" className="col-span-2">Payment History</Button>
              </CardContent>
            </Card>
            <MessagesCard />
          </div>
        )}
        {!rows ? <Skeleton className="h-64 w-full" /> : <TablePanel rows={rows} title="Draw Requests" />}
      </div>
      <div className="space-y-4">
        <QuickActions items={["Request Payoff Quote", "Submit Draw Request", "Upload Document"]} />
        <Card className="border border-slate-800/60 bg-slate-900/40">
          <CardContent className="py-6 text-center text-sm text-slate-300">Need a payoff quote?</CardContent>
        </Card>
      </div>
    </div>
  );
}

function ContractorView() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        <Card className="border border-slate-800/60 bg-slate-900/40">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-300">Project Progress</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-sm"><span className="text-slate-400">Progress</span><Progress value={76} className="h-2" /></div>
            <FundingScheduleCard />
          </CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <QuickActions items={["Upload Invoice", "Request Inspection", "View Funding Schedule"]} />
      </div>
    </div>
  );
}

function AdminView() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        <Card className="border border-slate-800/60 bg-slate-900/40">
          <CardContent className="py-6 text-center text-sm text-slate-300">Add your first user and assign a role.</CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <QuickActions items={["Add User", "Update Branding", "View Audit Log", "Configure Workflow"]} />
      </div>
    </div>
  );
}

export default function KontraDashboard({ role: initialRole = "lender", orgName = "Kontra", userName = "User" }) {
  const [role, setRole] = useState(initialRole);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
        <AppHeader orgName={orgName} role={role} onRoleChange={setRole} userName={userName} />

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
