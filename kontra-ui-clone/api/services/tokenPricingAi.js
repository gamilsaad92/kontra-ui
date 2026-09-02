const RISK_WEIGHTS = {
  dscr: 0.3,
  ltv: 0.25,
  delinquency: 0.2,
  volatility: 0.15,
  chain: 0.1,
};

const CHAIN_PREMIUMS = {
  ethereum: 0.0015,
  base: 0.0008,
  polygon: 0.001,
  default: 0.0012,
};

const RWA_PREMIUMS = {
  "cre loan": 0.0005,
  "equipment lease": 0.0009,
  "revenue-based financing": 0.0012,
  "smb term loan": 0.001,
  default: 0.0008,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalize(value, min, max) {
  const bounded = clamp(value, min, max);
  return (bounded - min) / (max - min);
}

function describeDrivers(inputs) {
  const drivers = [];
  if (inputs.dscr >= 1.25) drivers.push("strong DSCR");
  if (inputs.ltv <= 0.65) drivers.push("low leverage");
  if (inputs.delinquencyRate <= 0.01) drivers.push("clean on-time history");
  if (inputs.volatility <= 0.05) drivers.push("stable secondary pricing");
  if (inputs.chainPremium < 0.001) drivers.push("low chain risk");
  if (inputs.assetType) drivers.push(`${inputs.assetType} profile`);
  return drivers;
}

function scoreTokenPricing({
  navPerToken = 1,
  marketPrice = 1,
  dscr = 1.1,
  ltv = 0.7,
  delinquencyRate = 0.02,
  volatility = 0.06,
  chain = "base",
  assetType = "cre loan",
}) {
  const dscrScore = normalize(dscr, 0.8, 1.6);
  const ltvScore = 1 - normalize(ltv, 0.5, 0.85);
  const delinquencyScore = 1 - normalize(delinquencyRate, 0, 0.08);
  const volatilityScore = 1 - normalize(volatility, 0, 0.15);
  const chainPremium = CHAIN_PREMIUMS[chain?.toLowerCase?.()] ?? CHAIN_PREMIUMS.default;
  const rwaPremium = RWA_PREMIUMS[assetType?.toLowerCase?.()] ?? RWA_PREMIUMS.default;

  const blendedScore =
    dscrScore * RISK_WEIGHTS.dscr +
    ltvScore * RISK_WEIGHTS.ltv +
    delinquencyScore * RISK_WEIGHTS.delinquency +
    volatilityScore * RISK_WEIGHTS.volatility +
    (1 - chainPremium * 800) * RISK_WEIGHTS.chain;

  const riskPremiumBps = clamp((1 - blendedScore) * 320 + (chainPremium + rwaPremium) * 10000, 60, 420);
  const fairValue = navPerToken * (1 - riskPremiumBps / 10000) + (marketPrice - navPerToken) * 0.35;
  const confidence = clamp(0.55 + blendedScore * 0.35, 0.6, 0.95);

  return {
    fairValue: parseFloat(fairValue.toFixed(4)),
    riskPremiumBps: Math.round(riskPremiumBps),
    confidence: parseFloat(confidence.toFixed(2)),
    inputs: { navPerToken, marketPrice, dscr, ltv, delinquencyRate, volatility, chain, assetType, chainPremium },
    drivers: describeDrivers({ dscr, ltv, delinquencyRate, volatility, chainPremium, assetType }),
    rationale:
      "Weighted heuristics combine DSCR, leverage, payment history, and market volatility to propose a risk-adjusted price while layering chain and asset-type premiums.",
  };
}

function buildRwaExpansions() {
  return [
    {
      type: "CRE bridge loans",
      chain: "Base",
      status: "pilot",
      launchQuarter: "Q3",
      notes: "Warehouse-ready, tokenized via ERC-721 whole loans with ERC-20 participations",
    },
    {
      type: "Equipment leases",
      chain: "Polygon",
      status: "integration",
      launchQuarter: "Q4",
      notes: "Billing streams synced to cashflow splitter; oracle priced depreciation curves",
    },
    {
      type: "Revenue-based financing",
      chain: "Ethereum",
      status: "research",
      launchQuarter: "Q1",
      notes: "Variable payment waterfalls mapped to token coupons with KPI oracles",
    },
  ];
}

module.exports = {
  scoreTokenPricing,
  buildRwaExpansions,
};
