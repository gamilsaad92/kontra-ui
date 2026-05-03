import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STEPS = [
  {
    id: 'welcome',
    label: 'Platform Overview',
    tag: 'Platform Overview',
    tagColor: '#800020',
    tagBg: '#F9F0F2',
    accent: '#800020',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15l.75 18H3.75L4.5 3zM8.25 21V10.5M12 21V10.5M15.75 21V10.5" />
      </svg>
    ),
    headline: 'The operating system for CRE debt markets.',
    body: 'Kontra unifies every participant in commercial real estate lending on a single data platform — from loan origination through on-chain tokenization and secondary trading.',
    stats: [
      { label: 'AUM Managed', value: '$623.5M' },
      { label: 'Active Loans', value: '6' },
      { label: 'Portals', value: '4' },
      { label: 'On-Chain Settled', value: '$124.2M' },
    ],
    features: [
      'Four role-based portals sharing one live data source — no syncing, no lag',
      'Real-time covenant monitoring: DSCR, LTV, occupancy thresholds',
      'ERC-1400 tokenization and compliant secondary market built-in',
      'AI Copilot across every workflow — underwriting, compliance, market intel',
    ],
    cta: null,
    ctaPath: null,
  },
  {
    id: 'lender',
    label: 'Lender Portal',
    tag: 'LENDER',
    tagColor: '#800020',
    tagBg: '#F9F0F2',
    accent: '#800020',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
      </svg>
    ),
    headline: 'Originate, manage & monetize your CRE loan portfolio.',
    body: 'The command center for your entire book. AI-assisted underwriting generates term sheets in minutes. Live covenant dashboards flag risks before they breach. Tokenize senior tranches to unlock liquidity.',
    stats: [
      { label: 'Portfolio AUM', value: '$623.5M' },
      { label: 'Active Loans', value: '6' },
      { label: 'Covenants at Risk', value: '3' },
      { label: 'Tokenized', value: '$225.4M' },
    ],
    features: [
      'AI Underwriter — automated risk scoring, comps, and term sheet generation',
      'Portfolio overview — loan table with balance, rate, LTV, and status at a glance',
      'Compliance center — live DSCR, LTV, and occupancy covenant tracking per loan',
      'Tokenization — issue and manage ERC-1400 securities with on-chain distributions',
    ],
    cta: 'Open Lender Portal →',
    ctaPath: '/dashboard',
  },
  {
    id: 'servicer',
    label: 'Servicer Portal',
    tag: 'SERVICER',
    tagColor: '#92400E',
    tagBg: '#FFFBEB',
    accent: '#92400E',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
    headline: 'Payments, draws, inspections & escrow — all in one queue.',
    body: 'Servicers manage the full loan lifecycle from a single operations center. Draw requests arrive with supporting docs attached. Inspections are scheduled and tracked with AI-generated site condition reports.',
    stats: [
      { label: 'Draws Pending', value: '12' },
      { label: 'Queue Value', value: '$4.1M' },
      { label: 'Inspections Due', value: '4' },
      { label: 'Escrow Held', value: '$1.82M' },
    ],
    features: [
      'Draw queue — approve, reject, or request docs on construction disbursements',
      'Payment processing — SOFR-linked debt service with automated ledger entries',
      'Inspection tracker — schedule site visits, upload reports, flag deficiencies',
      'Escrow management — tax, insurance, and capex reserve tracking per loan',
    ],
    cta: 'Open Servicer Portal →',
    ctaPath: '/servicer/overview',
  },
  {
    id: 'investor',
    label: 'Investor Portal',
    tag: 'INVESTOR',
    tagColor: '#6D28D9',
    tagBg: '#F5F3FF',
    accent: '#6D28D9',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    headline: 'Holdings, distributions, governance & secondary trading.',
    body: 'Accredited investors see real-time NAV pricing, monthly on-chain distributions, and full transparency into the underlying loans. Vote on covenant modifications. Trade positions on the peer-to-peer secondary market.',
    stats: [
      { label: 'Investors', value: '10,290+' },
      { label: 'May Distributions', value: '$264.5K' },
      { label: 'Avg Yield', value: '7.4%' },
      { label: 'Secondary Volume', value: '$124.2M' },
    ],
    features: [
      'Live portfolio — token holdings, estimated value, and target yield per position',
      'Distributions — monthly on-chain payments with full transaction history',
      'Governance — vote on covenant waivers, modifications, and loan amendments',
      'Secondary market — peer-to-peer token trading, RFQs, and settlement',
    ],
    cta: 'Open Investor Portal →',
    ctaPath: '/investor',
  },
  {
    id: 'borrower',
    label: 'Borrower Portal',
    tag: 'BORROWER',
    tagColor: '#065F46',
    tagBg: '#ECFDF5',
    accent: '#065F46',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
      </svg>
    ),
    headline: 'Your loan dashboard — draws, docs, covenants & payments.',
    body: 'Borrowers get a transparent, real-time window into every aspect of their loan. Submit draw requests with supporting documents, monitor covenant compliance, track payment history, and message your servicer directly.',
    stats: [
      { label: 'Loan Balance', value: '$45.2M' },
      { label: 'DSCR', value: '1.42×' },
      { label: 'LTV', value: '68.2%' },
      { label: 'Next Payment', value: '$187.5K' },
    ],
    features: [
      'Loan dashboard — balance, floating rate, maturity date, and payment status',
      'Draw requests — submit, track approval status, and receive construction funds',
      'Document vault — upload rent rolls, financials, and insurance certificates',
      'Covenant monitoring — live DSCR, LTV, occupancy gauges vs. loan thresholds',
    ],
    cta: 'Open Borrower Portal →',
    ctaPath: '/borrower',
  },
  {
    id: 'ai',
    label: 'AI Copilot',
    tag: 'AI COPILOT',
    tagColor: '#5B21B6',
    tagBg: '#EDE9FE',
    accent: '#5B21B6',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
    headline: 'Natural language intelligence across every portal.',
    body: 'Ask anything about your portfolio in plain English. The AI Copilot routes your query to the right specialist agent — portfolio analysis, covenant monitoring, risk scoring, market data, or regulatory compliance.',
    stats: [
      { label: 'Specialist Agents', value: '6' },
      { label: 'Avg Response', value: '<2s' },
      { label: 'Data Points', value: '50K+' },
      { label: 'Portals Covered', value: 'All 4' },
    ],
    features: [
      'Portfolio Analyst — DSCR trends, concentration risk, LTV stress testing',
      'Compliance Agent — covenant breach detection and automated cure workflows',
      'Market Intelligence — cap rate comps, interest rate sensitivity, and benchmarks',
      'Regulatory Scanner — SEC Form D filing, Reg D/S compliance, and audit trails',
    ],
    cta: 'Open AI Copilot →',
    ctaPath: '/ai-copilot',
  },
  {
    id: 'markets',
    label: 'Capital Markets',
    tag: 'CAPITAL MARKETS',
    tagColor: '#1E40AF',
    tagBg: '#EFF6FF',
    accent: '#1E40AF',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
    headline: 'Tokenize CRE loans and enable secondary trading.',
    body: "Kontra turns illiquid CRE loans into ERC-1400 compliant digital securities. Structure senior and mezzanine tranches, launch Reg D/S offerings, and give investors a compliant secondary market — all from the same platform.",
    stats: [
      { label: 'Tokenized AUM', value: '$225.4M' },
      { label: 'Active Tokens', value: '2' },
      { label: 'Trades YTD', value: '$124.2M' },
      { label: 'Avg Settlement', value: '<60s' },
    ],
    features: [
      '$225.4M tokenized across 2 active ERC-1400 senior tranche securities',
      'Waterfall modeling — senior/mezz cash flow structuring and distribution',
      '$124.2M in secondary trades settled on-chain year-to-date',
      'Real-time NAV pricing and on-chain distribution via smart contracts',
    ],
    cta: 'Open Capital Markets →',
    ctaPath: '/markets/pools',
  },
]

export default function QuickStartTour({ onClose }) {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const current = STEPS[step]
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1

  const handleCta = () => {
    if (current.ctaPath) navigate(current.ctaPath)
    onClose && onClose()
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col overflow-hidden"
      style={{
        width: 500,
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 18,
        boxShadow: '0 12px 48px rgba(0,0,0,0.14), 0 2px 10px rgba(0,0,0,0.06)',
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: 3, background: current.accent, transition: 'background 0.3s' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #F1F5F9' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
            style={{ background: current.tagBg, color: current.accent }}
          >
            {current.icon}
          </div>
          <span className="text-sm font-bold text-gray-900" style={{ letterSpacing: '-0.01em' }}>
            {current.label}
          </span>
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: current.tagBg, color: current.accent }}
          >
            {current.tag}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium text-gray-400">
            {step + 1} / {STEPS.length}
          </span>
          <button
            onClick={() => onClose && onClose()}
            className="text-gray-300 hover:text-gray-600 transition-colors"
            aria-label="Close tour"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pt-5 pb-4">

        {/* Headline */}
        <h3 className="text-[15px] font-bold text-gray-900 mb-2 leading-snug" style={{ letterSpacing: '-0.02em' }}>
          {current.headline}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          {current.body}
        </p>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mb-4 rounded-xl p-3" style={{ background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
          {current.stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center text-center gap-0.5">
              <span className="text-base font-bold text-gray-900" style={{ letterSpacing: '-0.02em', color: current.accent }}>{s.value}</span>
              <span className="text-[10px] text-gray-400 font-medium leading-tight">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Feature list */}
        <ul className="space-y-2 mb-4">
          {current.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span
                className="mt-1 h-4 w-4 shrink-0 rounded-full flex items-center justify-center"
                style={{ background: current.tagBg }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke={current.accent} strokeWidth={2.5} className="h-2.5 w-2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </span>
              <span className="text-[13px] text-gray-700 leading-snug">{f}</span>
            </li>
          ))}
        </ul>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="rounded-full transition-all"
              style={{
                width: i === step ? 22 : 6,
                height: 6,
                background: i === step ? current.accent : '#E2E8F0',
              }}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          {!isFirst && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors border border-gray-200"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back
            </button>
          )}

          <div className="flex-1 flex gap-2">
            {current.cta && (
              <button
                onClick={handleCta}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: current.accent }}
              >
                {current.cta}
              </button>
            )}
            <button
              onClick={() => isLast ? (onClose && onClose()) : setStep(s => s + 1)}
              className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors"
              style={current.cta
                ? { background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }
                : { background: current.accent, color: '#FFFFFF' }
              }
            >
              {isLast ? 'Finish tour' : current.cta ? 'Next →' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
