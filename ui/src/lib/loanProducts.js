export const defaultDscrLoans = [
  {
    id: "LN-2045",
    borrower: "Redwood Capital Partners",
    principal: 12000000,
    dscr: 1.32,
    targetDscr: 1.25,
    baseCoupon: 6.1,
    rateFloor: 5.2,
    rateCap: 7.4,
    rateSensitivity: 1.6,
    interestAccruedMonth: 61250,
    lastRecalculated: "2024-09-30T09:00:00Z",
    nextReset: "2024-10-31T09:00:00Z",
    automationNotes: "Coupon stepped down 10 bps after DSCR beat target for two consecutive periods."
  },
  {
    id: "LN-2110",
    borrower: "Hudson River Holdings",
    principal: 8800000,
    dscr: 1.11,
    targetDscr: 1.20,
    baseCoupon: 6.85,
    rateFloor: 6.35,
    rateCap: 8.0,
    rateSensitivity: 1.8,
    interestAccruedMonth: 53420,
    lastRecalculated: "2024-09-30T08:30:00Z",
    nextReset: "2024-10-31T08:30:00Z",
    automationNotes: "Monitoring for step-up trigger; assigned to workout analyst for trend review."
  },
  {
    id: "LN-1988",
    borrower: "Cedar Grove Apartments",
    principal: 15300000,
    dscr: 1.47,
    targetDscr: 1.25,
    baseCoupon: 5.95,
    rateFloor: 5.35,
    rateCap: 7.2,
    rateSensitivity: 1.4,
    interestAccruedMonth: 78110,
    lastRecalculated: "2024-09-30T07:45:00Z",
    nextReset: "2024-10-31T07:45:00Z",
    automationNotes: "Eligible for green incentive stack; auto-applied blended step-down."
  }
];

export const defaultPerformanceLoans = [
  {
    id: "LN-2045",
    borrower: "Redwood Capital Partners",
    profitSharePct: 0.18,
    noiTarget: 850000,
    actualNoi: 910000,
    prefReturn: 0.07,
    lenderSplit: 0.8,
    sponsorSplit: 0.2,
    reserveBalance: 135000,
    lastWaterfall: "2024-09-25T18:00:00Z"
  },
  {
    id: "LN-2110",
    borrower: "Hudson River Holdings",
    profitSharePct: 0.22,
    noiTarget: 620000,
    actualNoi: 574000,
    prefReturn: 0.065,
    lenderSplit: 0.78,
    sponsorSplit: 0.22,
    reserveBalance: 91000,
    lastWaterfall: "2024-09-26T17:00:00Z"
  },
  {
    id: "LN-1988",
    borrower: "Cedar Grove Apartments",
    profitSharePct: 0.2,
    noiTarget: 1320000,
    actualNoi: 1395000,
    prefReturn: 0.072,
    lenderSplit: 0.82,
    sponsorSplit: 0.18,
    reserveBalance: 210000,
    lastWaterfall: "2024-09-24T17:30:00Z"
  }
];

export const defaultGreenLoans = [
  {
    id: "LN-2045",
    borrower: "Redwood Capital Partners",
    baseCoupon: 5.85,
    rateFloor: 5.25,
    rateCap: 7.0,
    lastIngested: "2024-09-28T13:00:00Z",
    energyProvider: "Aurora Energy Cloud",
    kpis: [
      {
        name: "Energy Intensity",
        unit: "kWh/sf",
        baseline: 22,
        current: 18,
        target: 17,
        direction: "decrease",
        rateDeltaBps: -12,
        source: "BMS telemetry"
      },
      {
        name: "Water Usage",
        unit: "gal/unit",
        baseline: 3200,
        current: 2950,
        target: 3000,
        direction: "decrease",
        rateDeltaBps: -6,
        source: "Utility API"
      },
      {
        name: "Carbon Intensity",
        unit: "kgCO₂e/sf",
        baseline: 18,
        current: 16.5,
        target: 15,
        direction: "decrease",
        rateDeltaBps: -8,
        source: "Energy Star Portfolio Manager"
      }
    ]
  },
  {
    id: "LN-2110",
    borrower: "Hudson River Holdings",
    baseCoupon: 6.45,
    rateFloor: 6.0,
    rateCap: 7.6,
    lastIngested: "2024-09-28T12:30:00Z",
    energyProvider: "GridSync Monitoring",
    kpis: [
      {
        name: "Solar Yield",
        unit: "MWh",
        baseline: 0,
        current: 145,
        target: 160,
        direction: "increase",
        rateDeltaBps: -10,
        source: "PV monitoring"
      },
      {
        name: "GHG Emissions",
        unit: "tCO₂e",
        baseline: 420,
        current: 415,
        target: 380,
        direction: "decrease",
        rateDeltaBps: -5,
        source: "Utility API"
      }
    ]
  },
  {
    id: "LN-1988",
    borrower: "Cedar Grove Apartments",
    baseCoupon: 5.65,
    rateFloor: 5.1,
    rateCap: 6.9,
    lastIngested: "2024-09-28T11:45:00Z",
    energyProvider: "Evergreen IoT",
    kpis: [
      {
        name: "Energy Intensity",
        unit: "kWh/sf",
        baseline: 24,
        current: 19,
        target: 18,
        direction: "decrease",
        rateDeltaBps: -10,
        source: "BMS telemetry"
      },
      {
        name: "LEED Recertification",
        unit: "score",
        baseline: 62,
        current: 68,
        target: 65,
        direction: "increase",
        rateDeltaBps: -7,
        source: "Certification upload"
      }
    ]
  }
];

const deriveSeed = (context) => {
  if (!context) return 1;
  const raw = `${context.id ?? ""}${context.borrower ?? ""}`;
  if (!raw) return 1;
  return raw.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
};

const normalizeContext = (context) => {
  if (!context) return {};
  const id =
    context.loan_code ??
    context.loan_number ??
    context.loanId ??
    context.loanID ??
    context.id ??
    null;
  const borrower = context.borrower_name ?? context.borrower ?? context.name ?? null;
  return { id, borrower };
};

export const findMatchingLoan = (collection, context) => {
  const { id, borrower } = normalizeContext(context);
  return (
    collection.find((loan) => (id ? `${loan.id}` === `${id}` : false)) ||
    collection.find((loan) =>
      borrower
        ? loan.borrower?.toLowerCase() === borrower.toLowerCase()
        : false
    ) ||
    null
  );
};

export const dscrFallbackForContext = (context) => {
  const normalized = normalizeContext(context);
  const match = findMatchingLoan(defaultDscrLoans, normalized);
  if (match) {
    return { ...match, ...normalized };
  }
  const seed = deriveSeed(normalized);
  const base = defaultDscrLoans[seed % defaultDscrLoans.length];
  const delta = ((seed % 15) - 7) / 100;
  const dscr = Math.max(0.9, Number((base.dscr + delta).toFixed(2)));
  const nextReset = new Date(Date.now() + ((seed % 5) + 1) * 24 * 60 * 60 * 1000 * 30);
  const lastRecalculated = new Date(Date.now() - ((seed % 7) + 1) * 24 * 60 * 60 * 1000);
  return {
    ...base,
    ...normalized,
    dscr,
    lastRecalculated: lastRecalculated.toISOString(),
    nextReset: nextReset.toISOString()
  };
};

export const performanceFallbackForContext = (context) => {
  const normalized = normalizeContext(context);
  const match = findMatchingLoan(defaultPerformanceLoans, normalized);
  if (match) {
    return { ...match, ...normalized };
  }
  const seed = deriveSeed(normalized);
  const base = defaultPerformanceLoans[seed % defaultPerformanceLoans.length];
  const noiVariance = ((seed % 12) - 6) * 12000;
  return {
    ...base,
    ...normalized,
    actualNoi: Math.max(0, base.noiTarget + noiVariance),
    lastWaterfall: new Date(Date.now() - ((seed % 6) + 1) * 24 * 60 * 60 * 1000).toISOString()
  };
};

export const greenFallbackForContext = (context) => {
  const normalized = normalizeContext(context);
  const match = findMatchingLoan(defaultGreenLoans, normalized);
  if (match) {
    return { ...match, ...normalized };
  }
  const seed = deriveSeed(normalized);
  const base = defaultGreenLoans[seed % defaultGreenLoans.length];
  const kpis = base.kpis.map((kpi, index) => {
    const drift = ((seed + index * 13) % 10) / 10;
    const direction = kpi.direction === "decrease" ? -1 : 1;
    const adjustment = direction * drift;
    return {
      ...kpi,
      current: Number((kpi.current + adjustment).toFixed(2))
    };
  });
  return {
    ...base,
    ...normalized,
    kpis,
    lastIngested: new Date(Date.now() - ((seed % 4) + 1) * 60 * 60 * 1000).toISOString()
  };
};

export const calculateAdjustedCoupon = (loan) => {
  const baseCoupon = Number(loan.baseCoupon ?? loan.coupon ?? 0);
  const dscr = Number(loan.dscr ?? loan.currentDscr ?? 0);
  const target = Number(loan.targetDscr ?? 1.25);
  const sensitivity = Number(loan.rateSensitivity ?? 1.2);
  const floor = Number(loan.rateFloor ?? baseCoupon);
  const cap = Number(loan.rateCap ?? baseCoupon);
  if (!dscr || !baseCoupon) {
    return { adjustedCoupon: baseCoupon, deltaBps: 0 };
  }
  const adjustment = (target - dscr) * sensitivity;
  const rawCoupon = baseCoupon + adjustment;
  const boundedCoupon = Math.min(Math.max(rawCoupon, floor), cap);
  return {
    adjustedCoupon: Number(boundedCoupon.toFixed(2)),
    deltaBps: Math.round((boundedCoupon - baseCoupon) * 100)
  };
};

export const computeFeeWaterfall = (loan) => {
  const noiTarget = Number(loan.noiTarget ?? 0);
  const actualNoi = Number(loan.actualNoi ?? 0);
  const profitSharePct = Number(loan.profitSharePct ?? 0);
  const prefReturn = Number(loan.prefReturn ?? 0);
  const baseNoi = Math.min(actualNoi, noiTarget);
  const excessNoi = Math.max(actualNoi - noiTarget, 0);
  const sponsorCarry = excessNoi * profitSharePct;
  const lenderDistribution = actualNoi - sponsorCarry;
  const prefPayment = noiTarget * prefReturn;
  const prefShortfall = Math.max(noiTarget - actualNoi, 0);
  return {
    baseNoi,
    excessNoi,
    sponsorCarry,
    lenderDistribution,
    prefPayment,
    prefShortfall
  };
};

export const computeGreenRateImpact = (loan) => {
  const kpis = Array.isArray(loan.kpis) ? loan.kpis : [];
  const triggered = kpis.filter((kpi) => {
    if (kpi.direction === "decrease") {
      return Number(kpi.current) <= Number(kpi.target);
    }
    return Number(kpi.current) >= Number(kpi.target);
  });
  const totalAdjustmentBps = triggered.reduce(
    (sum, kpi) => sum + Number(kpi.rateDeltaBps ?? 0),
    0
  );
  return {
    triggered,
    totalAdjustmentBps
  };
};
