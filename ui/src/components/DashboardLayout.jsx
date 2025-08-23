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
 *  Kontra Dashboard — matches reference layout
 *  - Dark header/sidebar; light content cards
 *  - Lender view == screenshot: Risk gauge + Delinquency bars,
 *    then Recent Activity / Troubled Assets / Campaign,
 *    then Asset list + AI Assistant
 * ------------------------------------------------------------
 */

const riskDonutData = [
  { name: "Current", value: 58 },
  { name: "30+", value: 22 },
  { name: "60+", value: 12 },
  { name: "90+", value: 8 },
];

const donutPalette = ["#94a3b8", "#60a5fa", "#34d399", "#f59e0b"]; // slate, sky, emerald, amber

async function getKpis(role: string) {
  const { data, error } = await supabase.rpc("get_kpis", { role });
  if (error || !data) throw error || new Error("Failed to load KPIs");
  return data;
}

async function getChartData(role: string) {
  const { data, error } = await supabase.rpc("get_chart_data", { role });
  if (error || !data) throw error || new Error("Failed to load chart data");
  return data;
}

async function getTableRows(role: string) {
  const { data, error } = await supabase
    .from("dashboard_rows")
    .select("id,name,status,amount,date")
    .eq("role", role);
  if (error || !data) throw error || new Error("Failed to load dashboard rows");
  return data;
}

/* ======================== Header & Nav ======================== */

function AppHeader({
  orgName,
  role,
  onRoleChange,
  userName,
}: {
  orgName: string;
  role: string;
  onRoleChange: (r: string) => void;
  userName: string;
}) {
  return (
    <div className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80 bg-slate-950/60 border-b border-slate-800/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-2">
        <div className="flex items-center gap-2 mr-2">
          <div className="h-7 w-7 rounded-xl bg-sky-400/20 ring-1 ring-sky-400/30 grid place-items-center font-bold">
            K
          </div>
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

      {/* role-specific subnav bar (subtle, like screenshot) */}
      <div className="border-t border-slate-800/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-10 flex items-center gap-4 overflow-x-auto">
          <RoleSubnav role={role} />
        </div>
      </div>
    </div>
  );
}

function RoleTabs({ role, onChange }: { role: string; onChange: (v: string) => void }) {
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

function RoleSubnav({ role }: { role: string }) {
  const items =
    {
      lender: ["Portfolio Overview", "Loan Pipeline", "Servicing Center", "Draw Requests", "Reports & Analytics"],
      investor: ["Portfolio Overview", "Lean Pipeline", "Servicing Center", "Draw Requests", "Reports & Analytics"],
      borrower: ["Loan Summary", "Draw Requests"],
      contractor: ["Project Progress", "Funding Schedule", "Documents"],
      admin: ["Users", "Branding", "Audit", "Workflows"],
    }[role] || [];

  return (
    <div className="flex items-center gap-6 text-sm">
      {items.map((label, idx) => (
        <div key={label} className={`whitespace-nowrap ${idx === 0 ? "text-slate-100" : "text-slate-400"}`}>
          {label}
        </div>
      ))}
    </div>
  );
}

/* ======================== Common Blocks ======================== */

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

/* ======================== Screenshot-Matching Cards ======================== */

function RiskScoreGauge({ score = 56, label = "Moderate" }) {
  // Semi-donut gauge using Pie (180°)
  const segs = [
    { name: "good", value: 35, color: "#10b981" }, // emerald
    { name: "mid", value: 25, color: "#f59e0b" }, // amber
    { name: "rest1", value: 20, color: "#e2e8f0" }, // slate-200
    { name: "rest2", value: 20, color: "#e2e8f0" },
  ];
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-800">Risk Score</CardTitle>
      </CardHeader>
      <CardContent className="h-56 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segs}
              startAngle={180}
              endAngle={0}
              innerRadius={70}
              outerRadius={90}
              dataKey="value"
              paddingAngle={2}
            >
              {segs.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
            <RTooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
          <div className="text-5xl font-semibold text-slate-900 leading-none">{score}</div>
          <div className="mt-1 text-sm text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function DelinquencyForecast({ data }: { data: { name: string; value: number }[] }) {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-800">Delinquency Forecast</CardTitle>
      </CardHeader>
      <CardContent className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#64748b" }} axisLine={false} tickLine={false} />
            <RTooltip />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#60a5fa" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function RecentActivity() {
  const rows = [
    { i: "📄", t: "Sign' doctuments", s: "1 hour ago", r: "Robert Fox" },
    { i: "✅", t: "Approval request", s: "2 hours ago", r: "Loan #2324" },
    { i: "💵", t: "Payment received", s: "3 hours ago", r: "Drawment" },
    { i: "🧾", t: "Draw request", s: "1 day ago", r: "Opend" },
  ];
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-800">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-slate-200">
          {rows.map((r, k) => (
            <li key={k} className="py-3 flex items-center">
              <div className="h-6 w-6 rounded-full bg-slate-100 grid place-items-center text-[10px]">{r.i}</div>
              <div className="ml-3">
                <div className="text-slate-800">{r.t}</div>
                <div className="text-xs text-slate-500">{r.s}</div>
              </div>
              <div className="ml-auto text-sm text-slate-500">{r.r}</div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function TroubledAssets() {
  const rows = [
    { a: "456 Elm St.", tag: "High", score: "" },
    { a: "333 Cedar Ln.", tag: "", score: "65" },
    { a: "1201 Pine Cir.", tag: "", score: "69" },
  ];
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-800">Troubled Assets</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left font-medium py-2">Risk level</th>
              <th className="text-left font-medium py-2">Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-200">
                <td className="py-2 text-slate-800">{r.a}</td>
                <td className="py-2">
                  {r.tag ? (
                    <span className="text-emerald-600 font-medium">{r.tag}</span>
                  ) : (
                    <span className="text-slate-700">{r.score}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CampaignTable() {
  const rows = [
    { p: "459 Birch Rd.", c: "Miami", r: "$475,000" },
    { p: "29 Lakeview Dr.", c: "Dallas", r: "$675,000" },
    { p: "6722 Oak Ave.", c: "Chicago", r: "$510,000" },
  ];
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-800">Revived Sale Marketing Campaign</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="text-left font-medium py-2">Property</th>
              <th className="text-left font-medium py-2">City</th>
              <th className="text-left font-medium py-2">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-200">
                <td className="py-2 text-slate-800">{r.p}</td>
                <td className="py-2 text-slate-600">{r.c}</td>
                <td className="py-2 text-slate-800">{r.r}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function AssetList() {
  const rows = [
    { a: "459 Birch Rd.", v: "$475,000" },
    { a: "29 Lakeview Dr.", v: "$623,000" },
    { a: "2702 Oak Ave.", v: "—" },
  ];
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-800">Troridcel Sale Assets</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex justify-between">
              <span className="text-slate-800">{r.a}</span>
              <span className="text-slate-600">{r.v}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function AssistantPanel() {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-800">AI Assistant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="rounded-xl bg-slate-100 px-3 py-3 text-sm text-slate-600">How can I assist you today?</div>
        <div className="rounded-xl bg-slate-100 px-3 py-3 text-sm text-slate-600"></div>
        <div className="flex justify-end">
          <Button size="icon" variant="secondary" className="rounded-full">
            ➤
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ======================== Views ======================== */

function LenderView() {
  // Static chart values to match screenshot spacing/feel
  const forecast = useMemo(
    () => [
      { name: "Apr", value: 15 },
      { name: "May", value: 20 },
      { name: "Jun", value: 26 },
      { name: "Jul", value: 24 },
    ],
    []
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {/* Top row: gauge + delinquency bars */}
      <div className="xl:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
        <RiskScoreGauge />
        <DelinquencyForecast data={forecast} />
      </div>

      {/* Middle row: three medium cards */}
      <div className="xl:col-span-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <RecentActivity />
        <TroubledAssets />
        <CampaignTable />
      </div>

      {/* Bottom row: assets left + AI assistant right */}
      <div className="xl:col-span-2">
        <AssetList />
      </div>
      <div>
        <AssistantPanel />
      </div>
    </div>
  );
}

/* You can keep simpler role views below; unchanged except styling harmony */

function InvestorView() {
  const [kpis, setKpis] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    getKpis("investor").then(setKpis).catch(() => setKpis(null));
    getChartData("investor").then(setData).catch(() => setData(null));
  }, []);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        {!kpis ? <Skeleton className="h-24 w-full" /> : <KpiRow kpis={kpis.primary} />}
        {!data ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <Card className="border border-slate-200 bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-800">ROI & Exposure</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <RTooltip />
                  <Bar dataKey="a" radius={[6, 6, 0, 0]} fill="#60a5fa" />
                  <Bar dataKey="b" radius={[6, 6, 0, 0]} fill="#34d399" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        <Card className="border border-slate-200 bg-white">
          <CardContent className="py-6 text-center text-sm text-slate-700">No new reports</CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <QuickActions items={["Export Report", "Set Alert Thresholds", "Download Statement"]} />
        <Card className="border border-slate-200 bg-white">
          <CardContent className="py-6 text-sm text-slate-700">
            Set risk alert thresholds to get notified when DSCR falls below 1.10x or delinquency &gt; 2%.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BorrowerView() {
  const [kpis, setKpis] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    getKpis("borrower").then(setKpis).catch(() => setKpis(null));
    getTableRows("borrower").then(setRows).catch(() => setRows([]));
  }, []);
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        {!kpis ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border border-slate-200 bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-800">Loan Summary</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-2xl font-semibold text-slate-900">$250,000</div>
                  <div className="text-slate-500">Interest Rate</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold text-slate-900">18/05/2026</div>
                  <div className="text-slate-500">Payoff Date</div>
                </div>
                <Button variant="secondary" className="col-span-2">
                  Payment History
                </Button>
              </CardContent>
            </Card>
            <MessagesCard />
          </div>
        )}
        {!rows.length ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <TablePanel rows={rows} title="Draw Requests" />
        )}
      </div>
      <div className="space-y-4">
        <QuickActions items={["Request Payoff Quote", "Submit Draw Request", "Upload Document"]} />
        <Card className="border border-slate-200 bg-white">
          <CardContent className="py-6 text-center text-sm text-slate-700">Need a payoff quote?</CardContent>
        </Card>
      </div>
    </div>
  );
}

function ContractorView() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        <Card className="border border-slate-200 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-800">Project Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-500">Progress</span>
              <Progress value={76} className="h-2" />
            </div>
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
        <Card className="border border-slate-200 bg-white">
          <CardContent className="py-6 text-center text-sm text-slate-700">Add your first user and assign a role.</CardContent>
        </Card>
      </div>
      <div className="space-y-4">
        <QuickActions items={["Add User", "Update Branding", "View Audit Log", "Configure Workflow"]} />
      </div>
    </div>
  );
}

/* ======================== Reusable Cards (light-styled) ======================== */

function QuickActions({ items }: { items: string[] }) {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-800">Quick Actions</CardTitle>
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

function KpiRow({ kpis }: { kpis: { label: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {kpis.map((k) => (
        <Card key={k.label} className="border border-slate-200 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-slate-500">{k.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-slate-900">{k.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MessagesCard() {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-800">Messages</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <Button variant="secondary" className="w-full justify-between">
          Upload Invoice<span className="text-xs text-slate-500">›</span>
        </Button>
        <Button variant="secondary" className="w-full justify-between">
          Request Inspection<span className="text-xs text-slate-500">›</span>
        </Button>
      </CardContent>
    </Card>
  );
}

function FundingScheduleCard() {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-800">Funding Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Funding Schedule</span>
          <span className="text-slate-800">8503/455533</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Alerts</span>
          <span className="text-slate-800">2</span>
        </div>
        <Button variant="secondary" size="sm" className="w-full">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </CardContent>
    </Card>
  );
}

function TablePanel({ rows, title = "Loan Pipeline" }: { rows: any[]; title?: string }) {
  return (
    <Card className="border border-slate-200 bg-white">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm text-slate-800">{title}</CardTitle>
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
          <thead className="text-slate-500 border-b border-slate-200">
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
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2 pr-4 text-slate-800">{r.name}</td>
                <td className="py-2 pr-4">
                  <Badge variant="secondary">{r.status}</Badge>
                </td>
                <td className="py-2 pr-4 text-slate-600">Team</td>
                <td className="py-2 pl-4 text-right text-slate-800">${r.amount.toLocaleString()}</td>
                <td className="py-2 pl-4 text-right text-slate-600">{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/* ======================== Page Shell ======================== */

export default function KontraDashboard({
  role: initialRole = "lender",
  orgName = "SaaS",
  userName = "Olivia",
}: {
  role?: string;
  orgName?: string;
  userName?: string;
}) {
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
            UI kit: Tailwind + shadcn/ui • Charts: Recharts • Built for a11y & performance
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
