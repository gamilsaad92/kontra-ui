import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TradeList from '../components/trades/TradeList';
import TradeForm from '../components/trades/TradeForm';
import Marketplace from '../components/trades/Marketplace';
import MiniCmbsPools from '../components/trades/MiniCmbsPools';
import ParticipationMarketplace from '../components/trades/ParticipationMarketplace';
import PreferredEquityTokens from '../components/trades/PreferredEquityTokens';
import { api, resolveApiBase } from '../lib/api';

const COMMON_FIELDS = [
  { name: 'symbol', label: 'Symbol', type: 'text', placeholder: 'Symbol', required: true, defaultValue: '' },
  {
    name: 'notional_amount',
    label: 'Notional Amount',
    type: 'number',
    placeholder: 'Notional Amount',
    required: true,
    defaultValue: ''
  },
  { name: 'quantity', label: 'Quantity', type: 'number', placeholder: 'Quantity', required: true, defaultValue: '' },
  { name: 'price', label: 'Price', type: 'number', placeholder: 'Price', required: true, defaultValue: '' },
  {
    name: 'side',
    label: 'Side',
    type: 'select',
    options: [
      { value: 'buy', label: 'Buy' },
      { value: 'sell', label: 'Sell' }
    ],
    required: true,
    defaultValue: 'buy',
    validate: value => (value === 'buy' || value === 'sell' ? null : 'Side must be buy or sell')
  },
  {
  name: 'wallet_address',
    label: 'Whitelisted Investor Wallet',
    type: 'text',
   placeholder: '0xCP1 or investor ID',
    required: true,
    defaultValue: '',
    helpText: 'Transfers are limited to investors that pass KYC and are on the whitelist.'
  },
  {
    name: 'jurisdiction',
    label: 'Investor Jurisdiction',
    type: 'select',
    options: [
      { value: 'US', label: 'United States' },
      { value: 'CA', label: 'Canada' },
      { value: 'GB', label: 'United Kingdom' },
      { value: 'DE', label: 'Germany' },
      { value: 'SG', label: 'Singapore' }
    ],
    required: true,
    defaultValue: 'US'
  },
  {
    name: 'investor_type',
    label: 'Investor Type',
    type: 'select',
    options: [
      { value: 'institutional', label: 'Institutional' },
      { value: 'qualified_purchaser', label: 'Qualified Purchaser' },
      { value: 'retail', label: 'Retail' }
    ],
    required: true,
    defaultValue: 'institutional'
  },
  {
    name: 'kyc_status',
    label: 'KYC Status',
    type: 'select',
    options: [
      { value: 'approved', label: 'Approved' },
      { value: 'pending', label: 'Pending' },
      { value: 'failed', label: 'Failed' }
    ],
    required: true,
    defaultValue: 'approved',
    helpText: 'Transfers only execute between addresses with approved KYC.'
  }
];

const TRADE_DEFINITIONS = [
  {
    type: 'loan_sale',
    title: 'Loan Sale',
    description: 'Execute whole-loan transfers with settlement coordination.',
    submitLabel: 'Submit Loan Sale',
    fields: []
  },
  {
    type: 'participation',
    title: 'Participation',
    description: 'Offer or request participations with cash flow schedules.',
    submitLabel: 'Submit Participation',
    fields: [
      {
        name: 'distribution_schedule',
        label: 'Distribution Schedule',
        type: 'text',
        placeholder: 'Monthly, Quarterly, etc.',
        required: true,
        defaultValue: ''
      }
    ]
  },
  {
    type: 'syndication_assignment',
    title: 'Syndication',
    description: 'Assign or assume agented syndication allocations.',
    submitLabel: 'Submit Syndication',
    fields: [
      {
        name: 'agent_bank',
        label: 'Agent Bank',
        type: 'text',
        placeholder: 'Agent institution name',
        required: true,
        defaultValue: ''
      }
    ]
  },
  {
    type: 'repo',
    title: 'Repo',
    description: 'Short-term financing secured by pledged collateral.',
    submitLabel: 'Submit Repo',
    fields: [
      {
        name: 'repo_rate_bps',
        label: 'Repo Rate (bps)',
        type: 'number',
        placeholder: 'e.g. 425',
        required: true,
        defaultValue: ''
      },
      {
        name: 'term_days',
        label: 'Term (days)',
        type: 'number',
        placeholder: 'e.g. 30',
        required: true,
        defaultValue: ''
      },
      {
        name: 'collateral_ref',
        label: 'Collateral Reference',
        type: 'text',
        placeholder: 'Pledge ID or description',
        required: true,
        defaultValue: ''
      }
    ]
  },
  {
    type: 'reverse_repo',
    title: 'Reverse Repo',
    description: 'Provide liquidity against received collateral.',
    submitLabel: 'Submit Reverse Repo',
    fields: [
      {
        name: 'repo_rate_bps',
        label: 'Reverse Rate (bps)',
        type: 'number',
        placeholder: 'e.g. 375',
        required: true,
        defaultValue: ''
      },
      {
        name: 'term_days',
        label: 'Term (days)',
        type: 'number',
        placeholder: 'e.g. 14',
        required: true,
        defaultValue: ''
      },
      {
        name: 'collateral_ref',
        label: 'Collateral Reference',
        type: 'text',
        placeholder: 'Received collateral reference',
        required: true,
        defaultValue: ''
      }
    ]
  }
];

const INITIAL_FORM_VALUES = createInitialFormTemplate();

function createInitialFormTemplate() {
  const base = COMMON_FIELDS.reduce((acc, field) => {
    acc[field.name] = field.defaultValue ?? '';
    return acc;
  }, {});
  return TRADE_DEFINITIONS.reduce((acc, definition) => {
    acc[definition.type] = {
      ...base,
      ...(definition.fields || []).reduce((extras, field) => {
        extras[field.name] = field.defaultValue ?? '';
        return extras;
      }, {})
    };
    return acc;
  }, {});
}

function cloneInitialValues(type) {
  return { ...INITIAL_FORM_VALUES[type] };
}

function validateValues(definition, fields, values, policy) {
  const errors = {};
  fields.forEach(field => {
    const rawValue = values?.[field.name];
    if (field.required) {
      if (field.type === 'number') {
        const num = Number(rawValue);
        if (!Number.isFinite(num) || num <= 0) {
          errors[field.name] = `${field.label} must be a positive number`;
          return;
        }
      } else if (field.type === 'select') {
        if (!rawValue) {
          errors[field.name] = `${field.label} is required`;
          return;
        }
      } else if (!String(rawValue ?? '').trim()) {
        errors[field.name] = `${field.label} is required`;
        return;
      }
    }
    if (typeof field.validate === 'function') {
      const message = field.validate(rawValue, values);
      if (message) {
        errors[field.name] = message;
      }
    }
  });
 const jurisdiction = String(values?.jurisdiction || '').toUpperCase();
  if (policy?.restrictedJurisdictions?.includes(jurisdiction)) {
    errors.jurisdiction = 'Transfers are blocked for this jurisdiction';
  }
  if (values?.kyc_status && values.kyc_status !== 'approved') {
    errors.kyc_status = 'KYC must be approved before submitting a trade';
      }
  const wallet = String(values?.wallet_address || '').trim();
  if (wallet && policy?.walletWhitelist?.enforced) {
    const whitelisted = (policy.whitelist || []).some(entry => {
      const id = String(entry.wallet_address || entry.id || '').toLowerCase();
      return id === wallet.toLowerCase();
    });
    if (!whitelisted) {
      errors.wallet_address = 'Wallet must be whitelisted and verified before trading';
    }
  }
  return errors;
}

function buildPayload(definition, values, policy) {
  const wallet = values.wallet_address?.trim();
  const jurisdiction = values.jurisdiction?.trim();
  const investorType = values.investor_type;
  const kycStatus = values.kyc_status;
   const whitelisted = (policy?.whitelist || []).find(entry => {
    const id = String(entry.wallet_address || entry.id || '').toLowerCase();
    return wallet && id === wallet.toLowerCase();
  });
  const payload = {
    trade_type: definition.type,
    symbol: values.symbol?.trim(),
    notional_amount: Number(values.notional_amount),
    quantity: Number(values.quantity),
    price: Number(values.price),
    side: values.side,
    counterparties: wallet ? [wallet] : [],
    counterparty_profiles: wallet
      ? [
          {
            id: wallet,
            wallet_address: wallet,
            jurisdiction,
            investor_type: investorType,
           kycApproved: kycStatus === 'approved',
            amlApproved: whitelisted?.amlApproved ?? kycStatus === 'approved',
            verified: whitelisted?.verified ?? false,
            kyc_provider: whitelisted?.kyc_provider || policy?.kycProvider?.name,
            aml_provider: whitelisted?.aml_provider || policy?.amlProvider?.name
          }
        ]
      : []
  };

  if (definition.type === 'participation') {
    payload.distribution_schedule = values.distribution_schedule?.trim();
  }
  if (definition.type === 'syndication_assignment') {
    payload.agent_bank = values.agent_bank?.trim();
  }
  if (definition.type === 'repo' || definition.type === 'reverse_repo') {
    payload.repo_rate_bps = values.repo_rate_bps ? Number(values.repo_rate_bps) : undefined;
    payload.term_days = values.term_days ? Number(values.term_days) : undefined;
    payload.collateral_ref = values.collateral_ref?.trim();
  }

  return payload;
}
export default function Trades() {
  const [trades, setTrades] = useState([]);
  const [marketEntries, setMarketEntries] = useState([]);
  const [cmbsPools, setCmbsPools] = useState([]);
  const [participations, setParticipations] = useState([]);
  const [preferredEquity, setPreferredEquity] = useState([]);
  const [toast, setToast] = useState(null);
   const [compliancePolicy, setCompliancePolicy] = useState({});
  
 const [forms, setForms] = useState(() =>
    TRADE_DEFINITIONS.reduce((acc, def) => {
      acc[def.type] = cloneInitialValues(def.type);
      return acc;
    }, {})
  );
  const [formErrors, setFormErrors] = useState({});
  const [activeType, setActiveType] = useState(TRADE_DEFINITIONS[0].type);
  const [submittingType, setSubmittingType] = useState(null);
  const toastTimer = useRef(null);

  const activeDefinition = useMemo(
    () => TRADE_DEFINITIONS.find(def => def.type === activeType) || TRADE_DEFINITIONS[0],
    [activeType]
  );
   const complianceAwareFields = useMemo(() => {
    const restrictedJurisdictions = (compliancePolicy?.restrictedJurisdictions || []).map(j =>
      String(j).toUpperCase()
    );
    const restrictedInvestorTypes = (compliancePolicy?.restrictedInvestorTypes || []).map(t =>
      String(t).toLowerCase()
    );

    return COMMON_FIELDS.map(field => {
      if (field.name === 'jurisdiction') {
        const allowed = field.options.filter(
          option => !restrictedJurisdictions.includes(String(option.value).toUpperCase())
        );
        return { ...field, options: allowed.length ? allowed : field.options };
      }
      if (field.name === 'investor_type') {
        const allowedTypes = field.options.filter(
          option => !restrictedInvestorTypes.includes(String(option.value).toLowerCase())
        );
        return { ...field, options: allowedTypes.length ? allowedTypes : field.options };
      }
      return field;
    });
  }, [compliancePolicy]);

  const activeFields = useMemo(
    () => [...complianceAwareFields, ...(activeDefinition?.fields || [])],
    [activeDefinition, complianceAwareFields]
  );
  const activeValues = forms[activeDefinition.type] || cloneInitialValues(activeDefinition.type);
  const activeErrors = formErrors[activeDefinition.type] || {};

  const notify = useCallback(message => {
    setToast(message);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchTrades = useCallback(async () => {
    try {
      const { data } = await api.get('/trades');
      setTrades(data.trades || []);
    } catch (err) {
      console.error('Failed to load trades', err);
    }
  }, []);

  const fetchMarketplace = useCallback(async () => {
    try {
      const { data } = await api.get('/marketplace');
      setMarketEntries(data.entries || []);
    } catch (err) {
      console.error('Failed to load marketplace entries', err);
    }
  }, []);

  const fetchMiniCmbs = useCallback(async () => {
    try {
      const { data } = await api.get('/exchange-programs/mini-cmbs');
      setCmbsPools(data.pools || []);
    } catch (err) {
      console.error('Failed to load mini-CMBS pools', err);
    }
  }, []);

  const fetchParticipations = useCallback(async () => {
    try {
      const { data } = await api.get('/exchange-programs/participations');
      setParticipations(data.participations || []);
    } catch (err) {
      console.error('Failed to load participations', err);
    }
  }, []);

  const fetchPreferredEquity = useCallback(async () => {
    try {
      const { data } = await api.get('/exchange-programs/preferred-equity');
      setPreferredEquity(data.tokens || []);
    } catch (err) {
      console.error('Failed to load preferred equity tokens', err);
    }
  }, []);
 
  const fetchCompliancePolicy = useCallback(async () => {
    try {
      const { data } = await api.get('/trades/compliance');
      setCompliancePolicy(data.policy || {});
    } catch (err) {
      console.error('Failed to load compliance guardrails', err);
    }
  }, []);
  
  useEffect(() => {
    fetchTrades();
   fetchMarketplace();
    fetchMiniCmbs();
    fetchParticipations();
    fetchPreferredEquity();
     fetchCompliancePolicy();
    
    const fallbackProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const fallbackUrl = `${fallbackProtocol}//${window.location.host}/collab`;
    const apiBase = resolveApiBase();

    let socketUrl = fallbackUrl;
    try {
      const resolvedApiUrl = new URL(apiBase, window.location.origin);
      if (resolvedApiUrl.origin !== window.location.origin) {
        const wsProtocol = resolvedApiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        socketUrl = `${wsProtocol}//${resolvedApiUrl.host}/collab`;
      }
    } catch {
      // ignore and use fallbackUrl
    }

    const ws = new WebSocket(socketUrl);
    ws.onmessage = evt => {
      try {
        const msg = JSON.parse(evt.data);
       if (msg.type === 'trade.created') {
          notify('Trade created');
          fetchTrades();
        } else if (msg.type === 'trade.settled') {
          notify('Trade settled');
          fetchTrades();
        } else if (msg.type === 'exchange.trade.settlement') {
          notify('Exchange settlement confirmed');
          fetchTrades();
        }
      } catch {
        // ignore malformed messages
      }
    };
    return () => {
      ws.close();
    };
  }, [
    fetchTrades,
    fetchMarketplace,
    fetchMiniCmbs,
    fetchParticipations,
    fetchPreferredEquity,
    fetchCompliancePolicy,
    notify
  ]);

  useEffect(() => () => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
  }, []);

  const handleFieldChange = useCallback((type, field, value) => {
    setForms(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  }, []);
 
  const resetForm = useCallback(type => {
    setForms(prev => ({
      ...prev,
      [type]: cloneInitialValues(type)
    }));
    setFormErrors(prev => ({
      ...prev,
      [type]: {}
    }));
  }, []);

  const submitTrade = useCallback(
    async definition => {
      const type = definition.type;
      const values = forms[type];
      const fieldDefs = activeFields;
      const validation = validateValues(definition, fieldDefs, values, compliancePolicy);
      if (Object.keys(validation).length) {
        setFormErrors(prev => ({
          ...prev,
          [type]: validation
        }));
        return;
      }

      setSubmittingType(type);
      setFormErrors(prev => ({
        ...prev,
        [type]: {}
      }));

      try {
        const { data } = await api.post('/trades', buildPayload(definition, values, compliancePolicy));
        const flags = data?.trade?.compliance_flags || [];
        notify(
          flags.length
            ? `Trade submitted with ${flags.length} compliance note${flags.length > 1 ? 's' : ''}`
            : 'Trade submitted'
        );
        resetForm(type);
        fetchTrades();
      } catch (err) {
        const message = err?.response?.data?.message || 'Failed to submit trade';
        setFormErrors(prev => ({
          ...prev,
          [type]: { form: message }
        }));
        notify(message);
      } finally {
        setSubmittingType(null);
      }
    },
   [activeFields, compliancePolicy, fetchTrades, forms, notify, resetForm]
  );

  const settleTrade = useCallback(
    async id => {
      try {
        await api.post(`/trades/${id}/settle`);
        notify('Trade settled');
        fetchTrades();
      } catch (err) {
        const message = err?.response?.data?.message || 'Failed to settle trade';
        notify(message);
      }
    },
    [fetchTrades, notify]
  );

  const openTrades = trades.filter(t => t.status === 'pending');
  const completedTrades = trades.filter(t => t.status === 'settled');
   const restrictedJurisdictions = compliancePolicy?.restrictedJurisdictions || [];
  const restrictedInvestorTypes = compliancePolicy?.restrictedInvestorTypes || [];
  const whitelistedInvestors = compliancePolicy?.whitelist || [];
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Trades</h1>
      {toast && (
       <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-md">
          {toast}
        </div>
      )}
      <section className="mb-8">
           <div className="border rounded p-4 bg-white shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Compliance guardrails</h2>
              <p className="text-sm text-gray-600">
                {compliancePolicy?.paused
                  ? 'Transfers are paused until legal completes a review.'
                  : 'Whitelist, KYC, and jurisdiction restrictions are enforced on every trade.'}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded text-sm font-medium ${
                compliancePolicy?.paused
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {compliancePolicy?.paused ? 'Paused' : 'Active'}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3 text-sm text-gray-700 mt-4">
            <div>
              <p className="font-medium">Whitelisted investors</p>
              {whitelistedInvestors.length ? (
                <ul className="list-disc list-inside text-gray-700 mt-1 space-y-1">
                  {whitelistedInvestors.map(entry => (
                    <li key={entry.wallet_address || entry.id}>
                      {entry.wallet_address || entry.id}{' '}
                      {entry.jurisdiction ? `(${entry.jurisdiction})` : ''}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No whitelist loaded yet.</p>
              )}
            </div>
            <div>
              <p className="font-medium">Restricted jurisdictions</p>
              <p className="text-gray-600 mt-1">
                {restrictedJurisdictions.length
                  ? restrictedJurisdictions.join(', ')
                  : 'None configured'}
              </p>
            </div>
            <div>
              <p className="font-medium">Excluded investor types</p>
              <p className="text-gray-600 mt-1">
                {restrictedInvestorTypes.length
                  ? restrictedInvestorTypes.join(', ')
                  : 'All eligible investor types allowed'}
              </p>
            </div>
          </div>
        </div>     
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="border rounded p-4 bg-white shadow-sm">
            <div className="flex flex-wrap gap-2 mb-4">
              {TRADE_DEFINITIONS.map(definition => (
                <button
                  key={definition.type}
                  type="button"
                  onClick={() => setActiveType(definition.type)}
                  className={`px-3 py-1 rounded border text-sm transition-colors ${
                    activeType === definition.type
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                  }`}
                  aria-pressed={activeType === definition.type}
                >
                  {definition.title}
                </button>
              ))}
            </div>
            <TradeForm
              definition={activeDefinition}
              fields={activeFields}
              values={activeValues}
              errors={activeErrors}
              isSubmitting={submittingType === activeDefinition.type}
              onChange={(field, value) => handleFieldChange(activeDefinition.type, field, value)}
              onSubmit={() => submitTrade(activeDefinition)}
            />
          </div>
          <div className="border rounded p-4 bg-white shadow-sm">
            <Marketplace
              entries={marketEntries}
              onSubmitted={() => {
                fetchMarketplace();
                notify('Marketplace order posted');
              }}
            />
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          <TradeList trades={openTrades} title="Open Trades" onSettle={settleTrade} />
          <TradeList trades={completedTrades} title="Settled Trades" />
        </div>
                <div className="mt-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-gray-700 shadow-sm md:grid-cols-3">
          <div className="space-y-1">
            <p className="font-medium">KYC / AML provider</p>
            <p className="text-gray-900">{compliancePolicy?.kycProvider?.name || 'Not configured'}</p>
            <p className="text-gray-600">
              {compliancePolicy?.amlProvider?.name
                ? `${compliancePolicy.amlProvider.name} watchlist + sanctions checks enforced.`
                : 'Add a provider to block unsettled addresses.'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">Issuance partner</p>
            <p className="text-gray-900">{compliancePolicy?.issuancePartner?.name || 'Pending'}</p>
            <p className="text-gray-600">
              {compliancePolicy?.issuancePartner?.services?.join(', ') ||
                'Configure Securitize, Polymesh, or Tokeny for Reg D / Reg S transfer legends.'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">Wallet whitelist</p>
            <p className="text-gray-900">
              {compliancePolicy?.walletWhitelist?.enforced
                ? 'Only verified investors can hold tokens'
                : 'Whitelist not enforced'}
            </p>
            <p className="text-gray-600">
              {compliancePolicy?.walletWhitelist?.registrySize
                ? `${compliancePolicy.walletWhitelist.registrySize} wallets synced from transfer agent registry.`
                : 'Connect the transfer agent registry to enforce custody limits.'}
            </p>
          </div>
        </div>
      </section>
      <MiniCmbsPools pools={cmbsPools} onRefresh={fetchMiniCmbs} onNotify={notify} />
      <ParticipationMarketplace listings={participations} onRefresh={fetchParticipations} onNotify={notify} />
      <PreferredEquityTokens tokens={preferredEquity} onRefresh={fetchPreferredEquity} onNotify={notify} />
    </div>
  );
}
