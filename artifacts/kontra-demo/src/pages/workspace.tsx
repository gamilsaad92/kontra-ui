import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, FileText, Users, Brain, Package,
  Check, Clock, AlertCircle, Upload, ArrowLeft,
  TrendingUp, TrendingDown, Minus, Shield, ChevronRight,
  Mail, Lock, FileCheck, Activity, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoContext } from "@/context/DemoContext";
import type { ChecklistStatus } from "@/lib/packs";

// ── Tab config ──────────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",      label: "Overview",      icon: LayoutDashboard },
  { id: "documents",     label: "Documents",     icon: FileText },
  { id: "participants",  label: "Participants",  icon: Users },
  { id: "intelligence",  label: "Intelligence",  icon: Brain },
  { id: "closing",       label: "Closing",       icon: Package },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Status helpers ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: ChecklistStatus }) {
  const map: Record<ChecklistStatus, { label: string; cls: string; icon: React.ElementType }> = {
    complete:    { label: "Complete",    cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: Check },
    in_progress: { label: "In Progress", cls: "text-amber-400  bg-amber-400/10  border-amber-400/20",   icon: Clock },
    pending:     { label: "Pending",     cls: "text-muted-foreground bg-muted/20 border-border/40",      icon: AlertCircle },
  };
  const { label, cls, icon: Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium border rounded px-1.5 py-0.5 ${cls}`}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    high:   "text-red-400   bg-red-400/10   border-red-400/20",
    medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    low:    "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  };
  return (
    <span className={`inline-block text-[10px] font-medium border rounded px-1.5 py-0.5 uppercase tracking-wide ${map[level] ?? ""}`}>
      {level}
    </span>
  );
}

// ── Score ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="relative inline-flex items-center justify-center w-28 h-28">
      <svg width="112" height="112" className="-rotate-90">
        <circle cx="56" cy="56" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-border/40" />
        <motion.circle
          cx="56" cy="56" r={r} fill="none" stroke="currentColor" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, delay: 0.3, ease: "easeOut" }}
          className="text-primary"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold font-mono">{score}</div>
        <div className="text-xs text-muted-foreground">{grade}</div>
      </div>
    </div>
  );
}

// ── Trend icon ───────────────────────────────────────────────────────────────
function TrendIcon({ trend, positive }: { trend: string; positive: boolean }) {
  const up = trend === "up";
  const neutral = trend === "neutral";
  const good = up === positive;
  if (neutral) return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
  const Icon = up ? TrendingUp : TrendingDown;
  return <Icon className={`w-3.5 h-3.5 ${good ? "text-emerald-400" : "text-red-400"}`} />;
}

// ── Stage progress bar ───────────────────────────────────────────────────────
function StageProgress({ stages, current }: { stages: { id: string; label: string }[]; current: number }) {
  return (
    <div className="flex items-center gap-0 w-full">
      {stages.map((stage, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={stage.id} className="flex-1 flex items-center">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${
                done ? "bg-primary border-primary" :
                active ? "bg-primary/20 border-primary" :
                "bg-transparent border-border"
              }`} />
              <span className={`text-[9px] mt-1 text-center leading-tight ${
                active ? "text-primary font-medium" : done ? "text-muted-foreground" : "text-muted-foreground/50"
              }`}>
                {stage.label}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div className={`h-px flex-1 mb-3.5 ${i < current ? "bg-primary" : "bg-border/40"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Workspace ───────────────────────────────────────────────────────────
export default function Workspace() {
  const [, setLocation] = useLocation();
  const { selectedPack, dealName } = useDemoContext();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [invitedRoles, setInvitedRoles] = useState<string[]>([]);
  const [sharedWithCounterparty, setSharedWithCounterparty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedPack) setLocation("/");
  }, [selectedPack, setLocation]);

  if (!selectedPack) {
    return null;
  }

  const pack = selectedPack;

  const handleUpload = (file: File) => {
    setUploadedFile(file);
    setAnalyzing(true);
    setTimeout(() => { setAnalyzing(false); setAnalyzed(true); setActiveTab("intelligence"); }, 2800);
  };

  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  // ── Tab content ─────────────────────────────────────────────────────────
  function OverviewTab() {
    const complete = pack.checklist.filter(i => i.status === "complete").length;
    const total = pack.checklist.length;
    const pct = Math.round((complete / total) * 100);
    return (
      <div className="space-y-6">
        {/* Stage progress */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-serif font-semibold text-lg">{pack.name}</h3>
              <p className="text-sm text-muted-foreground">{pack.tagline}</p>
            </div>
            <span className="text-xs font-mono border border-border rounded px-2 py-1 text-muted-foreground">
              Stage {pack.currentStage + 1} of {pack.stages.length}
            </span>
          </div>
          <StageProgress stages={pack.stages} current={pack.currentStage} />
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-5 text-center">
            <div className="text-3xl font-bold font-mono text-primary mb-1">{pct}%</div>
            <div className="text-xs text-muted-foreground">Checklist Progress</div>
            <div className="text-[10px] text-muted-foreground/60 mt-1">{complete} of {total} items</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 text-center">
            <div className="text-3xl font-bold font-mono mb-1">
              {pack.roles.filter(r => r.invited).length}
              <span className="text-lg text-muted-foreground">/{pack.roles.length}</span>
            </div>
            <div className="text-xs text-muted-foreground">Participants</div>
            <div className="text-[10px] text-muted-foreground/60 mt-1">Roles invited</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 text-center">
            <div className="text-3xl font-bold font-mono mb-1">{pack.insights.score}</div>
            <div className="text-xs text-muted-foreground">Deal Score</div>
            <div className="text-[10px] text-muted-foreground/60 mt-1">AI Assessment</div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" /> Recent Activity
          </h4>
          <div className="space-y-3">
            {pack.auditTrail.slice(0, 4).map((entry, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{entry.action}</span>
                  <span className="text-xs text-muted-foreground ml-2">by {entry.actor}</span>
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{entry.timestamp}</span>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-3 text-xs text-muted-foreground" onClick={() => setActiveTab("closing")}>
            View full audit trail <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  function DocumentsTab() {
    return (
      <div className="space-y-5">
        {/* Checklist */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-muted-foreground" />
              Document Checklist
              <span className="text-xs text-muted-foreground font-normal">
                · {pack.checklist.filter(i => i.status === "complete").length}/{pack.checklist.length} complete
              </span>
            </h4>
            <span className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
              {pack.badge} PACK
            </span>
          </div>
          <div className="divide-y divide-border/50">
            {pack.checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-shrink-0">
                  {item.status === "complete" ? (
                    <div className="w-5 h-5 rounded bg-primary/15 flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                  ) : item.status === "in_progress" ? (
                    <div className="w-5 h-5 rounded border-2 border-amber-400/60 bg-amber-400/5" />
                  ) : (
                    <div className="w-5 h-5 rounded border border-border/60" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Assigned: {item.assignedRole}</p>
                </div>
                <div className="flex items-center gap-2">
                  {item.required && (
                    <span className="text-[9px] text-muted-foreground/60 border border-border/40 rounded px-1.5">REQ</span>
                  )}
                  <StatusBadge status={item.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upload area */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4 text-muted-foreground" /> Upload Document
          </h4>
           <input
             ref={fileRef}
             type="file"
             accept=".pdf,.xls,.xlsx,.csv"
             className="hidden"
             onChange={e => {
               if (e.target.files?.[0]) handleUpload(e.target.files[0]);
               e.currentTarget.value = "";
             }}
           />
          {analyzing ? (
            <div className="border border-dashed border-primary/40 rounded-lg p-8 text-center space-y-3">
              <div className="flex justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">AI is analyzing <strong className="text-foreground">{uploadedFile?.name}</strong>…</p>
              <p className="text-xs text-muted-foreground">Extracting data points and risk signals</p>
            </div>
          ) : analyzed ? (
            <div className="border border-dashed border-emerald-500/40 bg-emerald-500/5 rounded-lg p-6 text-center space-y-2">
              <Check className="w-7 h-7 text-emerald-400 mx-auto" />
              <p className="text-sm font-medium">{uploadedFile?.name} analyzed</p>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setActiveTab("intelligence")}>
                View AI Analysis <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          ) : (
            <div
              className="border-2 border-dashed border-border/50 hover:border-primary/40 rounded-lg p-10 text-center cursor-pointer transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={event => event.preventDefault()}
              onDrop={handleFileDrop}
            >
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">Drag & drop or click to upload</p>
              <p className="text-xs text-muted-foreground">PDF, Excel, or CSV — AI extracts and scores instantly</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  function ParticipantsTab() {
    return (
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Participant Roles
              <span className="text-xs text-muted-foreground font-normal">
                · {pack.roles.filter(r => r.invited).length} invited, {pack.roles.filter(r => !r.invited).length} pending
              </span>
            </h4>
          </div>
          <div className="divide-y divide-border/50">
            {pack.roles.map((role) => (
              <div key={role.name} className="flex items-center gap-4 px-5 py-4">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 text-white"
                  style={{ backgroundColor: role.avatarColor + "33", color: role.avatarColor }}
                >
                  {role.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{role.name}</p>
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                </div>
                {role.invited ? (
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs text-emerald-400">Invited</span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 gap-1.5"
                    onClick={() => setInvitedRoles(current => [...current, role.name])}
                  >
                    <Mail className="w-3 h-3" /> Invite
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* OTP gate explainer */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-1">OTP-Gated Access</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every participant receives a unique invite link. Before accessing any deal room content,
                they verify via one-time passcode sent to their email. Kontra logs every verification
                event to the audit trail.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function IntelligenceTab() {
    if (!analyzed && !uploadedFile) {
      return (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm font-medium mb-2">No document analyzed yet</p>
          <p className="text-xs text-muted-foreground mb-4">Upload a document in the Documents tab to see AI analysis</p>
          <Button size="sm" variant="outline" onClick={() => setActiveTab("documents")}>
            Go to Documents
          </Button>
        </div>
      );
    }
    const { insights } = pack;
    return (
      <div className="space-y-5">
        {/* Score + summary */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start gap-6">
            <ScoreRing score={insights.score} grade={insights.grade} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-serif font-semibold">AI Deal Assessment</h4>
                <span className="text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5">{pack.badge}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{insights.summary}</p>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {insights.metrics.map((m) => (
            <div key={m.label} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{m.label}</span>
                <TrendIcon trend={m.trend} positive={m.positive} />
              </div>
              <div className="text-lg font-bold font-mono">{m.value}</div>
            </div>
          ))}
        </div>

        {/* Risk signals */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h4 className="text-sm font-medium">Risk Signals</h4>
          </div>
          <div className="divide-y divide-border/50">
            {insights.risks.map((risk, i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-4">
                <RiskBadge level={risk.level} />
                <div>
                  <p className="text-sm font-medium">{risk.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{risk.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function ClosingTab() {
    return (
      <div className="space-y-5">
        {/* Closing package */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" /> Closing Package
            </h4>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1.5"
              onClick={() => setSharedWithCounterparty(true)}
            >
              <Lock className="w-3 h-3" /> {sharedWithCounterparty ? "Shared with Counterparty" : "Share with Counterparty"}
            </Button>
          </div>
          <div className="p-5 space-y-3">
            {pack.checklist.filter(i => i.status === "complete").map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-accent/30 border border-border/40">
                <FileCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-sm">{item.label}</span>
                <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-1.5 py-0.5">Verified</span>
              </div>
            ))}
            {pack.checklist.filter(i => i.status !== "complete").length > 0 && (
              <p className="text-xs text-muted-foreground pt-2">
                {pack.checklist.filter(i => i.status !== "complete").length} items still pending before close
              </p>
            )}
          </div>
        </div>

        {/* Audit trail */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" /> Audit Trail
            </h4>
          </div>
          <div className="divide-y divide-border/40">
            {pack.auditTrail.map((entry, i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-3.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-2 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm">{entry.action}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-medium text-foreground/70">{entry.actor}</span> · {entry.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const TAB_CONTENT: Record<TabId, React.ReactNode> = {
    overview:     <OverviewTab />,
    documents:    <DocumentsTab />,
    participants: <ParticipantsTab />,
    intelligence: <IntelligenceTab />,
    closing:      <ClosingTab />,
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/40 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center gap-4 py-3.5">
            <button
              onClick={() => setLocation("/")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
                  {pack.badge}
                </span>
                <h1 className="text-sm font-semibold truncate">{dealName}</h1>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Stage {pack.currentStage + 1}: {pack.stages[pack.currentStage]?.label}
              </p>
            </div>
            <div className="hidden md:block">
              <StageProgress stages={pack.stages} current={pack.currentStage} />
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-0 -mb-px overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab body */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {TAB_CONTENT[activeTab]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
