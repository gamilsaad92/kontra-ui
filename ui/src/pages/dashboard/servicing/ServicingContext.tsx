import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

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

type ServicingContextValue = {
  alerts: ServicingAlert[];
  tasks: ServicingTask[];
  auditTrail: AuditEntry[];
  addAlert: (alert: ServicingAlert) => void;
  addTask: (task: ServicingTask) => void;
  logAudit: (entry: AuditEntry) => void;
  requestApproval: (action: string, detail: string) => void;
};

const ServicingContext = createContext<ServicingContextValue | undefined>(undefined);

const DEFAULT_ALERTS: ServicingAlert[] = [
  {
    id: "alert-borrower-variance",
    title: "Borrower financial variance flagged",
    detail: "Q2 DSCR drop of 18% requires reviewer acknowledgment.",
    severity: "high",
    category: "Borrower Financials",
  },
  {
    id: "alert-escrow-shortage",
    title: "Escrow shortage projected",
    detail: "$42,000 shortage expected ahead of the next tax payment.",
    severity: "high",
    category: "Escrow",
  },
  {
    id: "alert-management-change",
    title: "Management change pending documentation",
    detail: "Pending signed management agreement and insurance certificates.",
    severity: "medium",
    category: "Management",
  },
  {
    id: "alert-ai-validation",
    title: "AI photo validation needs review",
    detail: "2 inspection photo sets flagged for human QA.",
    severity: "medium",
    category: "AI Validation",
  },
];

const DEFAULT_TASKS: ServicingTask[] = [
  {
    id: "task-financial-review",
    title: "Review borrower upload package",
    detail: "Income statement + rent roll for May 2024.",
    status: "open",
    category: "Borrower Financials",
  },
  {
    id: "task-escrow-reconcile",
    title: "Run escrow reconciliation",
    detail: "Confirm tax installment coverage for Loan 1102.",
    status: "open",
    category: "Escrow",
  },
  {
    id: "task-management-approval",
    title: "Approve management change request",
    detail: "Pending lender approval before notifying counterparties.",
    status: "in-review",
    category: "Management",
    requiresApproval: true,
  },
  {
    id: "task-ai-photo",
    title: "Resolve AI photo validation",
    detail: "Inspection photos require human validation before closeout.",
    status: "open",
    category: "AI Validation",
  },
];

const DEFAULT_AUDIT: AuditEntry[] = [
  {
    id: "audit-escrow",
    action: "Escrow projection run",
    detail: "Auto-generated 12-month escrow forecast.",
    timestamp: new Date().toISOString(),
    status: "logged",
  },
  {
    id: "audit-ai-validation",
    action: "AI photo validation queued",
    detail: "Draw 4491 and Inspection 33 queued for AI review.",
    timestamp: new Date().toISOString(),
    status: "logged",
  },
];

export function ServicingProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<ServicingAlert[]>(DEFAULT_ALERTS);
  const [tasks, setTasks] = useState<ServicingTask[]>(DEFAULT_TASKS);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>(DEFAULT_AUDIT);

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
      addAlert,
      addTask,
      logAudit,
      requestApproval,
    }),
    [alerts, tasks, auditTrail]
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
