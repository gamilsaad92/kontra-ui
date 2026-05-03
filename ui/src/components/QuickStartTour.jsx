import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STEPS = [
  {
    id: 'welcome',
    label: 'Welcome to Kontra',
    tag: 'Platform Overview',
    tagColor: '#0F172A',
    tagBg: '#F1F5F9',
    accent: '#0F172A',
    accentBg: '#F8FAFC',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15l.75 18H3.75L4.5 3zM8.25 21V10.5M12 21V10.5M15.75 21V10.5" />
      </svg>
    ),
    headline: 'The operating system for CRE debt markets.',
    body: 'Kontra is a single unified platform connecting every participant in commercial real estate lending — lenders, servicers, investors, and borrowers. From loan origination through on-chain tokenization and secondary trading, every workflow is connected.',
    features: [
      'Four role-based portals — one data source',
      'Real-time compliance monitoring and risk controls',
      'On-chain tokenization and secondary markets',
      'AI-powered intelligence across every workflow',
    ],
    cta: null,
    ctaPath: null,
  },
  {
    id: 'lender',
    label: 'Lender Portal',
    tag: 'LENDER',
    tagColor: '#E5484D',
    tagBg: '#FDECEC',
    accent: '#E5484D',
    accentBg: '#FDECEC',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
      </svg>
    ),
    headline: 'Originate, manage, and monetize CRE loans.',
    body: 'The Lender Portal is the command center for your entire loan portfolio. Originate loans with AI-assisted underwriting, track covenant compliance in real time, manage capital markets activity, and distribute risk through tokenization.',
    features: [
      'AI Underwriter — automated risk scoring and term sheets',
      'Portfolio dashboard — $600M+ AUM across 6 loans',
      'Compliance center — DSCR, LTV, and occupancy covenants',
      'Tokenization — ERC-1400 token issuance and management',
    ],
    cta: 'Open Lender Portal →',
    ctaPath: '/dashboard',
  },
  {
    id: 'servicer',
    label: 'Servicer Portal',
    tag: 'SERVICER',
    tagColor: '#B45309',
    tagBg: '#FEF3C7',
    accent: '#B45309',
    accentBg: '#FEF3C7',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
    headline: 'Payments, draws, and asset operations.',
    body: 'The Servicer Portal gives servicers everything needed to manage performing and non-performing loans — from processing monthly debt service payments and approving draw requests to coordinating property inspections and handling hazard loss recovery.',
    features: [
      'Payment processing — SOFR-linked debt service tracking',
      'Draw management — construction and capex disbursements',
      'Inspection intelligence — AI-powered site condition reports',
      'Hazard & recovery — loss mitigation and insurance claims',
    ],
    cta: 'Open Servicer Portal →',
    ctaPath: '/servicer/overview',
  },
  {
    id: 'investor',
    label: 'Investor Portal',
    tag: 'INVESTOR',
    tagColor: '#7C3AED',
    tagBg: '#F5F3FF',
    accent: '#7C3AED',
    accentBg: '#F5F3FF',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    headline: 'Holdings, distributions, and governance.',
    body: 'The Investor Portal gives accredited investors complete visibility into their CRE debt investments — real-time NAV pricing, monthly distribution tracking, governance voting on loan modifications, and access to secondary market trading.',
    features: [
      '10,290+ accredited investors across Reg D 506(c) offerings',
      'Monthly distributions — $264,500 paid on-chain May 2026',
      'Governance — vote on covenant waivers and modifications',
      'Secondary market — peer-to-peer token trading and RFQs',
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
    accentBg: '#ECFDF5',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
      </svg>
    ),
    headline: 'Loan status, documents, and communication.',
    body: 'The Borrower Portal gives property owners and sponsors a direct window into their loan — real-time payment status, draw request submissions, document uploads, covenant reporting, and direct messaging with their servicer.',
    features: [
      'Loan dashboard — balance, rate, maturity, and payment history',
      'Draw requests — submit, track, and receive construction draws',
      'Document vault — upload and manage loan documents',
      'Servicer messaging — direct communication and notices',
    ],
    cta: 'Open Borrower Portal →',
    ctaPath: '/borrower',
  },
  {
    id: 'ai',
    label: 'AI Copilot',
    tag: 'AI / INTELLIGENCE',
    tagColor: '#7C5CFF',
    tagBg: '#F3F0FF',
    accent: '#7C5CFF',
    accentBg: '#F3F0FF',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
    headline: 'Natural language intelligence across every portal.',
    body: 'The AI Copilot is a cross-portal intelligence layer powered by specialized agents — portfolio analysis, covenant monitoring, risk scoring, market intelligence, and regulatory scanning. Ask anything about your portfolio in plain English.',
    features: [
      'Portfolio Analyst — DSCR trends, concentration risk, LTV analysis',
      'Compliance Agent — covenant breach detection and cure workflows',
      'Market Intelligence — cap rate comps and interest rate sensitivity',
      'Regulatory Scanner — SEC Form D, Reg D/S compliance monitoring',
    ],
    cta: 'Open AI Copilot →',
    ctaPath: '/ai-copilot',
  },
  {
    id: 'markets',
    label: 'Capital Markets',
    tag: 'CAPITAL MARKETS',
    tagColor: '#1D4ED8',
    tagBg: '#DBEAFE',
    accent: '#1D4ED8',
    accentBg: '#DBEAFE',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
    headline: 'Tokenize CRE loans and enable secondary trading.',
    body: "Kontra's Capital Markets module turns illiquid CRE loans into ERC-1400 compliant digital securities. Lenders can tokenize senior tranches, create Reg D/S offerings, and enable accredited investors to trade on a compliant secondary market.",
    features: [
      '$225.4M tokenized across 2 active ERC-1400 tokens',
      'Waterfall modeling — cash flow distribution and tranche structuring',
      'Secondary market — $124.2M in trades settled YTD',
      'On-chain distributions — real-time settlement via smart contracts',
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
      className="fixed bottom-5 right-5 z-50 flex flex-col"
      style={{
        width: 420,
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: '1px solid #F1F5F9' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: current.tagBg, color: current.tagColor }}
          >
            {current.tag}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-gray-400">
            {step + 1} of {STEPS.length}
          </span>
          <button
            onClick={() => onClose && onClose()}
            className="text-gray-300 hover:text-gray-500 transition-colors"
            aria-label="Close tour"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pt-5 pb-4">
        {/* Icon + Headline */}
        <div className="flex items-start gap-3.5 mb-4">
          <div
            className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: current.accentBg, color: current.accent }}
          >
            {current.icon}
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 leading-tight" style={{ letterSpacing: '-0.01em' }}>
              {current.headline}
            </h3>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-500 leading-relaxed mb-4">
          {current.body}
        </p>

        {/* Feature list */}
        <ul className="space-y-1.5 mb-5">
          {current.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: current.accent }} />
              <span className="text-xs text-gray-600 leading-snug">{f}</span>
            </li>
          ))}
        </ul>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className="rounded-full transition-all"
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                background: i === step ? current.accent : '#E5E7EB',
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
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors border border-gray-200"
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
                className="flex-1 rounded-lg py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: current.accent }}
              >
                {current.cta}
              </button>
            )}
            <button
              onClick={() => isLast ? (onClose && onClose()) : setStep(s => s + 1)}
              className="flex-1 rounded-lg py-2 text-sm font-semibold transition-colors"
              style={current.cta
                ? { background: '#F8FAFC', color: '#64748B', border: '1px solid #E5E7EB' }
                : { background: current.accent, color: '#FFFFFF' }
              }
            >
              {isLast ? 'Finish tour' : current.cta ? 'Next' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
