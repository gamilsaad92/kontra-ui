import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../../../lib/apiClient";

export type ServicingAlert = {
  id: string;
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
  category: string;
};

export type ServicingTask = {
  id: string;
  title: string;
  detail: string;
  status: "open" | "in-review" | "approved" | "blocked";
  category: string;
  requiresApproval?: boolean;
};

export type AuditEntry = {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
  status: "logged" | "pending-approval" | "approved";
};

export type ServicedLoan = {
  id: string;
  borrower: string;
  property: string;
  type: string;
  city: string;
  balance: number;
  rate: number;
  nextPayment: string;
  paymentStatus: "current" | "due" | "late" | "watch";
  maturity: string;
  dscr: number;
  ltv: number;
};

type ServicingContextValue = {
  alerts: ServicingAlert[];
  tasks: ServicingTask[];
  auditTrail: AuditEntry[];
  loans: ServicedLoan[];
  addAlert: (alert: ServicingAlert) => void;
  addTask: (task: ServicingTask) => void;
  logAudit: (entry: AuditEntry) => void;
  requestApproval: (action: string, detail: string) => void;
};

const ServicingContext = createContext<ServicingContextValue | undefined>(undefined);

const DEFAULT_ALERTS: ServicingAlert[] = [
  {
    id: "alert-borrower-variance",
    title: "DSCR decline flagged — 550 Madison Ave",
    detail: "Q1 DSCR dropped 18% to 1.04x — below 1.20x covenant. Reviewer acknowledgment required.",
    severity: "high",
    category: "Borrower Financials",
  },
  {
    id: "alert-escrow-shortage",
    title: "Escrow shortage projected — 1 Harbor View",
    detail: "$42,000 shortage expected ahead of the June 15 tax installment. Cure notice ready to send.",
    severity: "high",
    category: "Escrow",
  },
  {
    id: "alert-late-payment",
    title: "Late payment — Westfield Mall East",
    detail: "April payment of $31,250 is 8 days past due. Borrower contact attempted twice.",
    severity: "high",
    category: "Payments",
  },
  {
    id: "alert-management-change",
    title: "Management change pending documentation",
    detail: "Pending signed management agreement and updated insurance certificates for Greenbrook Apts.",
    severity: "medium",
    category: "Management",
  },
  {
    id: "alert-ai-validation",
    title: "AI photo validation needs review",
    detail: "2 inspection photo sets for Draw #4491 flagged for human QA.",
    severity: "medium",
    category: "AI Validation",
  },
  {
    id: "alert-draw-pending",
    title: "Draw request awaiting approval",
    detail: "Phase 3 draw of $840,000 submitted for 200 Commerce Dr. Lien waivers received.",
    severity: "low",
    category: "Draws",
  },
];

const DEFAULT_TASKS: ServicingTask[] = [
  {
    id: "task-financial-review",
    title: "Review Q1 borrower financials — 550 Madison Ave",
    detail: "DSCR covenant breach requires reviewer sign-off before month-end.",
    status: "in-review",
    category: "Borrower Financials",
    requiresApproval: true,
  },
  {
    id: "task-escrow-cure",
    title: "Send escrow cure notice — 1 Harbor View",
    detail: "Auto-generated cure letter ready. Lender approval required before delivery.",
    status: "in-review",
    category: "Escrow",
    requiresApproval: true,
  },
  {
    id: "task-late-payment-call",
    title: "Borrower outreach — Westfield Mall East",
    detail: "Schedule cure call within 3 business days per servicing agreement.",
    status: "open",
    category: "Payments",
  },
  {
    id: "task-draw-approval",
    title: "Approve Phase 3 draw — 200 Commerce Dr",
    detail: "Inspector certification received. SOV verified. Ready for lender approval.",
    status: "open",
    category: "Draws",
    requiresApproval: true,
  },
  {
    id: "task-management-approval",
    title: "Approve management change — Greenbrook Apts",
    detail: "New PM agreement under review. Pending lender approval.",
    status: "in-review",
    category: "Management",
    requiresApproval: true,
  },
  {
    id: "task-ai-photo",
    title: "Resolve AI photo validation — Draw #4491",
    detail: "Inspection photos require human validation before draw closeout.",
    status: "open",
    category: "AI Validation",
  },
  {
    id: "task-escrow-reconcile",
    title: "Monthly escrow reconciliation",
    detail: "Confirm tax and insurance coverage across all 12 active loans.",
    status: "open",
    category: "Escrow",
  },
];

const DEFAULT_AUDIT: AuditEntry[] = [
  {
    id: "audit-escrow",
    action: "Escrow projection run — 1 Harbor View",
    detail: "Auto-generated 12-month forecast. Shortage of $42,000 flagged.",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    status: "logged",
  },
  {
    id: "audit-ai-validation",
    action: "AI photo validation queued — Draw #4491",
    detail: "2 flagged frames sent to QA queue for reviewer confirmation.",
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    status: "logged",
  },
  {
    id: "audit-dscr-flag",
    action: "DSCR covenant breach detected — 550 Madison Ave",
    detail: "Policy engine triggered alert. Approval request sent to lender portal.",
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    status: "pending-approval",
  },
  {
    id: "audit-draw-received",
    action: "Draw package received — Phase 3, 200 Commerce Dr",
    detail: "SOV, invoices, and lien waivers uploaded by borrower.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    status: "logged",
  },
  {
    id: "audit-payment-posted",
    action: "Payment posted — 1 Harbor View",
    detail: "April payment of $16,520 received and applied to loan balance.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
    status: "approved",
  },
  {
    id: "audit-management",
    action: "Management change request opened — Greenbrook Apts",
    detail: "Borrower submitted new PM agreement. Checklist initiated.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    status: "pending-approval",
  },
];

const DEFAULT_LOANS: ServicedLoan[] = [
  {
    id: "L001",
    borrower: "Madison Capital LLC",
    property: "550 Madison Ave",
    type: "Office",
    city: "New York, NY",
    balance: 4200000,
    rate: 6.25,
    nextPayment: "May 1",
    paymentStatus: "current",
    maturity: "Dec 2026",
    dscr: 1.04,
    ltv: 65,
  },
  {
    id: "L002",
    borrower: "Harbor View Partners",
    property: "1 Harbor View",
    type: "Multi-Family",
    city: "Miami, FL",
    balance: 2800000,
    rate: 5.9,
    nextPayment: "May 1",
    paymentStatus: "current",
    maturity: "Mar 2027",
    dscr: 1.42,
    ltv: 72,
  },
  {
    id: "L003",
    borrower: "Westfield Properties Inc",
    property: "Westfield Mall East",
    type: "Retail",
    city: "Chicago, IL",
    balance: 5450000,
    rate: 6.75,
    nextPayment: "Apr 1",
    paymentStatus: "late",
    maturity: "Jun 2028",
    dscr: 1.18,
    ltv: 58,
  },
  {
    id: "L004",
    borrower: "Commerce Industrial Group",
    property: "200 Commerce Dr",
    type: "Industrial",
    city: "Austin, TX",
    balance: 3100000,
    rate: 6.1,
    nextPayment: "May 1",
    paymentStatus: "current",
    maturity: "Aug 2027",
    dscr: 1.61,
    ltv: 61,
  },
  {
    id: "L005",
    borrower: "City Center Holdings",
    property: "City Center Mixed-Use",
    type: "Mixed-Use",
    city: "Denver, CO",
    balance: 1900000,
    rate: 5.75,
    nextPayment: "May 1",
    paymentStatus: "due",
    maturity: "Jan 2026",
    dscr: 1.29,
    ltv: 68,
  },
  {
    id: "L006",
    borrower: "Greenbrook Residential LLC",
    property: "Greenbrook Apts",
    type: "Multi-Family",
    city: "Atlanta, GA",
    balance: 4800000,
    rate: 6.5,
    nextPayment: "May 1",
    paymentStatus: "watch",
    maturity: "Oct 2029",
    dscr: 1.15,
    ltv: 74,
  },
];

export function ServicingProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<ServicingAlert[]>(DEFAULT_ALERTS);
  const [tasks, setTasks] = useState<ServicingTask[]>(DEFAULT_TASKS);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>(DEFAULT_AUDIT);
  const [loans] = useState<ServicedLoan[]>(DEFAULT_LOANS);

  useEffect(() => {
    api
      .get<{ alerts: ServicingAlert[]; tasks: ServicingTask[]; auditTrail: AuditEntry[] }>(
        "/servicer/overview"
      )
      .then(({ data }) => {
        if (data?.alerts?.length)     setAlerts(data.alerts);
        if (data?.tasks?.length)      setTasks(data.tasks);
        if (data?.auditTrail?.length) setAuditTrail(data.auditTrail);
      })
      .catch(() => {});
  }, []);

  const addAlert = (alert: ServicingAlert) => {
    setAlerts((prev) => [alert, ...prev.filter((item) => item.id !== alert.id)]);
  };

  const addTask = (task: ServicingTask) => {
    setTasks((prev) => [task, ...prev.filter((item) => item.id !== task.id)]);
  };

  const logAudit = (entry: AuditEntry) => {
    setAuditTrail((prev) => [entry, ...prev]);
  };

  const requestApproval = (action: string, detail: string) => {
    const id = `approval-${Date.now()}`;
    addTask({
      id,
      title: action,
      detail,
      status: "in-review",
      category: "Approvals",
      requiresApproval: true,
    });
    logAudit({
      id,
      action,
      detail,
      timestamp: new Date().toISOString(),
      status: "pending-approval",
    });
  };

  const value = useMemo(
    () => ({
      alerts,
      tasks,
      auditTrail,
      loans,
      addAlert,
      addTask,
      logAudit,
      requestApproval,
    }),
    [alerts, tasks, auditTrail, loans]
  );

  return <ServicingContext.Provider value={value}>{children}</ServicingContext.Provider>;
}

export function useServicingContext() {
  const context = useContext(ServicingContext);
  if (!context) {
    throw new Error("useServicingContext must be used within ServicingProvider");
  }
  return context;
}
