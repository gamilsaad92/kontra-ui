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
  { id: "LN-2847", property: "300 Mission Street", city: "San Francisco, CA", type: "Multi-Family", balance: 141200000, rate: "6.25%", rateNum: 6.25, status: "active", maturity: "Dec 2027", ytd: 7.4, distributions: 2840000, ltv: 62, dscr: 1.38 },
  { id: "LN-5544", property: "Pacific Industrial Park", city: "Los Angeles, CA", type: "Industrial", balance: 84200000, rate: "5.90%", rateNum: 5.9, status: "active", maturity: "Mar 2028", ytd: 6.1, distributions: 1420000, ltv: 55, dscr: 1.52 },
  { id: "LN-3201", property: "Riverside Commons", city: "Austin, TX", type: "Multi-Family", balance: 96400000, rate: "6.50%", rateNum: 6.5, status: "active", maturity: "Jun 2029", ytd: 5.9, distributions: 1180000, ltv: 68, dscr: 1.22 },
  { id: "LN-4012", property: "Harbor View Office Tower", city: "Miami, FL", type: "Office", balance: 128700000, rate: "6.00%", rateNum: 6.0, status: "watch", maturity: "Sep 2027", ytd: 4.8, distributions: 820000, ltv: 74, dscr: 1.08 },
];

const BORROWER_LOANS: Loan[] = [
  { id: "LN-4012", property: "Harbor View Office Tower", city: "Miami, FL", type: "Office", balance: 128700000, rate: "6.10%", rateNum: 6.1, status: "current", maturity: "Sep 2027", nextPayment: "$643,500" },
  { id: "LN-1899", property: "City Center Mixed-Use", city: "Denver, CO", type: "Mixed-Use", balance: 74200000, rate: "5.75%", rateNum: 5.75, status: "current", maturity: "Jan 2027", nextPayment: "$356,150" },
  { id: "LN-6671", property: "Greenbrook Apartments", city: "Atlanta, GA", type: "Multi-Family", balance: 112300000, rate: "6.50%", rateNum: 6.5, status: "review", maturity: "Oct 2029", nextPayment: "$609,625" },
];

const INVESTOR_ACTIVITY: ActivityItem[] = [
  { id: "1", type: "distribution", title: "Q1 Distribution Received", subtitle: "300 Mission St · LN-2847 · KTRA-2847", amount: "+$284,000", date: "Apr 15, 2026", read: true },
  { id: "2", type: "valuation", title: "Property Valuation Updated", subtitle: "Pacific Industrial Park · LN-5544", amount: "$84.2M", date: "Apr 10, 2026", read: true },
  { id: "3", type: "document", title: "Q1 Investor Report Ready", subtitle: "All holdings · ERC-1400 verified PDF", date: "Apr 5, 2026", read: false },
  { id: "4", type: "distribution", title: "Q1 Distribution Received", subtitle: "Riverside Commons · LN-3201 · KTRA-3201", amount: "+$118,000", date: "Apr 1, 2026", read: true },
  { id: "5", type: "alert", title: "DSCR Alert — Watchlist", subtitle: "Harbor View Office Tower dropped to 1.08x", date: "Mar 28, 2026", read: true },
  { id: "6", type: "distribution", title: "Q4 2025 Distribution", subtitle: "All holdings · $604.7M pool", amount: "+$892,400", date: "Jan 15, 2026", read: true },
];

const BORROWER_ACTIVITY: ActivityItem[] = [
  { id: "1", type: "payment", title: "Monthly Payment Processed", subtitle: "Harbor View Office Tower · LN-4012", amount: "-$643,500", date: "Apr 1, 2026", read: true },
  { id: "2", type: "document", title: "Insurance Certificate Approved", subtitle: "Greenbrook Apartments · LN-6671", date: "Mar 28, 2026", read: false },
  { id: "3", type: "message", title: "Servicer Response", subtitle: "Re: Covenant Certification Request", date: "Mar 25, 2026", read: false },
  { id: "4", type: "payment", title: "Monthly Payment Processed", subtitle: "City Center Mixed-Use · LN-1899", amount: "-$356,150", date: "Mar 1, 2026", read: true },
  { id: "5", type: "alert", title: "Document Required", subtitle: "T-12 Rent Roll due Apr 30 · LN-6671", date: "Feb 15, 2026", read: true },
];

const INVESTOR_SUMMARY: PortfolioSummary = {
  totalValue: 450100000,
  activeLoans: 4,
  ytdReturn: 7.2,
  ytdDistributions: 5260000,
};

const BORROWER_SUMMARY: PortfolioSummary = {
  totalDebt: 315200000,
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
