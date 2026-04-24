import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export type LoanStatus = "active" | "current" | "pending" | "review" | "watch" | "late";

export interface Loan {
  id: string;
  property: string;
  city?: string;
  type: string;
  balance: number;
  rate: string;
  rateNum?: number;
  status: LoanStatus;
  maturity: string;
  nextPayment?: string;
  ytd?: number;
  distributions?: number;
  ltv?: number;
  dscr?: number;
}

export interface ActivityItem {
  id: string;
  type: "distribution" | "payment" | "document" | "message" | "valuation" | "alert";
  title: string;
  subtitle: string;
  amount?: string;
  date: string;
  read: boolean;
}

export interface PortfolioSummary {
  totalValue: number;
  activeLoans: number;
  ytdReturn?: number;
  nextPaymentDate?: string;
  totalDebt?: number;
  ytdDistributions?: number;
}

const INVESTOR_LOANS: Loan[] = [
  { id: "L001", property: "550 Madison Ave", city: "New York, NY", type: "Office", balance: 4200000, rate: "6.25%", rateNum: 6.25, status: "active", maturity: "Dec 2026", ytd: 7.1, distributions: 84000, ltv: 65, dscr: 1.04 },
  { id: "L002", property: "1 Harbor View", city: "Miami, FL", type: "Multi-Family", balance: 2800000, rate: "5.90%", rateNum: 5.9, status: "active", maturity: "Mar 2027", ytd: 6.8, distributions: 56000, ltv: 72, dscr: 1.42 },
  { id: "L003", property: "Westfield Mall East", city: "Chicago, IL", type: "Retail", balance: 5450000, rate: "6.75%", rateNum: 6.75, status: "pending", maturity: "Jun 2028", ytd: 0, distributions: 0, ltv: 58 },
  { id: "L004", property: "Gateway Office Park", city: "Austin, TX", type: "Office", balance: 3100000, rate: "6.00%", rateNum: 6.0, status: "active", maturity: "Sep 2027", ytd: 6.2, distributions: 62000, ltv: 61 },
];

const BORROWER_LOANS: Loan[] = [
  { id: "L004", property: "200 Commerce Dr", city: "Austin, TX", type: "Industrial", balance: 3100000, rate: "6.10%", rateNum: 6.1, status: "current", maturity: "Aug 2027", nextPayment: "$18,450" },
  { id: "L005", property: "City Center Mixed-Use", city: "Denver, CO", type: "Mixed-Use", balance: 1900000, rate: "5.75%", rateNum: 5.75, status: "current", maturity: "Jan 2026", nextPayment: "$11,200" },
  { id: "L006", property: "Greenbrook Apts", city: "Atlanta, GA", type: "Multi-Family", balance: 4800000, rate: "6.50%", rateNum: 6.5, status: "review", maturity: "Oct 2029", nextPayment: "$28,750" },
];

const INVESTOR_ACTIVITY: ActivityItem[] = [
  { id: "1", type: "distribution", title: "Q1 Distribution Received", subtitle: "550 Madison Ave · L001", amount: "+$24,500", date: "Apr 15, 2026", read: true },
  { id: "2", type: "valuation", title: "Property Valuation Updated", subtitle: "1 Harbor View · L002", amount: "$2.8M", date: "Apr 10, 2026", read: true },
  { id: "3", type: "document", title: "Q1 Investor Report Ready", subtitle: "All holdings · PDF", date: "Apr 5, 2026", read: false },
  { id: "4", type: "distribution", title: "Q1 Distribution Received", subtitle: "Gateway Office Park · L004", amount: "+$18,200", date: "Apr 1, 2026", read: true },
  { id: "5", type: "alert", title: "Maturity Notice", subtitle: "550 Madison Ave matures Dec 2026", date: "Mar 28, 2026", read: true },
  { id: "6", type: "distribution", title: "Q4 Distribution Received", subtitle: "All holdings", amount: "+$89,400", date: "Jan 15, 2026", read: true },
];

const BORROWER_ACTIVITY: ActivityItem[] = [
  { id: "1", type: "payment", title: "Monthly Payment Processed", subtitle: "200 Commerce Dr · L004", amount: "-$18,450", date: "Apr 1, 2026", read: true },
  { id: "2", type: "document", title: "Insurance Certificate Approved", subtitle: "Greenbrook Apts · L006", date: "Mar 28, 2026", read: false },
  { id: "3", type: "message", title: "Servicer Response", subtitle: "Re: Payoff Request", date: "Mar 25, 2026", read: false },
  { id: "4", type: "payment", title: "Monthly Payment Processed", subtitle: "City Center Mixed · L005", amount: "-$11,200", date: "Mar 1, 2026", read: true },
  { id: "5", type: "alert", title: "Document Required", subtitle: "Rent Roll due Apr 30", date: "Feb 15, 2026", read: true },
];

const INVESTOR_SUMMARY: PortfolioSummary = {
  totalValue: 15550000,
  activeLoans: 3,
  ytdReturn: 7.2,
  ytdDistributions: 202000,
};

const BORROWER_SUMMARY: PortfolioSummary = {
  totalDebt: 9800000,
  activeLoans: 3,
  nextPaymentDate: "May 1",
};

const API_BASE = "https://kontra-api.onrender.com";

async function tryFetchLoans(token: string, role: string): Promise<Loan[] | null> {
  try {
    const res = await fetch(`${API_BASE}/api/portfolio/loans`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data?.loans) && data.loans.length > 0) return data.loans;
    return null;
  } catch {
    return null;
  }
}

async function tryFetchActivity(token: string): Promise<ActivityItem[] | null> {
  try {
    const res = await fetch(`${API_BASE}/api/portfolio/activity`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data?.items) && data.items.length > 0) return data.items;
    return null;
  } catch {
    return null;
  }
}

interface UsePortfolioDataResult {
  loans: Loan[];
  activity: ActivityItem[];
  summary: PortfolioSummary;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  isLive: boolean;
}

export function usePortfolioData(): UsePortfolioDataResult {
  const { user } = useAuth();
  const token = user?.accessToken ?? null;
  const isInvestor = user?.role === "investor";

  const fallbackLoans = isInvestor ? INVESTOR_LOANS : BORROWER_LOANS;
  const fallbackActivity = isInvestor ? INVESTOR_ACTIVITY : BORROWER_ACTIVITY;
  const fallbackSummary = isInvestor ? INVESTOR_SUMMARY : BORROWER_SUMMARY;

  const [loans, setLoans] = useState<Loan[]>(fallbackLoans);
  const [activity, setActivity] = useState<ActivityItem[]>(fallbackActivity);
  const [summary, setSummary] = useState<PortfolioSummary>(fallbackSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (token) {
      const [apiLoans, apiActivity] = await Promise.all([
        tryFetchLoans(token, user?.role ?? ""),
        tryFetchActivity(token),
      ]);

      if (apiLoans) {
        setLoans(apiLoans);
        const totalValue = apiLoans.reduce((s: number, l: Loan) => s + l.balance, 0);
        setSummary((prev) => ({ ...prev, totalValue, activeLoans: apiLoans.filter((l: Loan) => l.status === "active" || l.status === "current").length }));
        setIsLive(true);
      } else {
        setLoans(fallbackLoans);
        setSummary(fallbackSummary);
      }

      if (apiActivity) {
        setActivity(apiActivity);
      } else {
        setActivity(fallbackActivity);
      }
    } else {
      await new Promise((r) => setTimeout(r, 600));
      setLoans(fallbackLoans);
      setActivity(fallbackActivity);
      setSummary(fallbackSummary);
    }

    setLoading(false);
  }, [token, user?.role]);

  useEffect(() => {
    load();
  }, [load]);

  return { loans, activity, summary, loading, error, refresh: load, isLive };
}
