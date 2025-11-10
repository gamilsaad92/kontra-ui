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
    name: 'counterparties',
    label: 'Counterparties',
    type: 'text',
    placeholder: 'Counterparties (comma separated)',
    required: true,
    defaultValue: '',
    helpText: 'Provide at least one counterparty identifier.'
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

function validateValues(definition, fields, values) {
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
  if (!errors.counterparties) {
    const counterparties = String(values?.counterparties || '')
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean);
    if (!counterparties.length) {
      errors.counterparties = 'Enter at least one counterparty';
    }
  }
  return errors;
}

function buildPayload(definition, values) {
  const payload = {
    trade_type: definition.type,
    symbol: values.symbol?.trim(),
    notional_amount: Number(values.notional_amount),
    quantity: Number(values.quantity),
    price: Number(values.price),
    side: values.side,
    counterparties: String(values.counterparties || '')
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean)
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
  const activeFields = useMemo(
    () => [...COMMON_FIELDS, ...(activeDefinition?.fields || [])],
    [activeDefinition]
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
 
  useEffect(() => {
    fetchTrades();
   fetchMarketplace();
    fetchMiniCmbs();
    fetchParticipations();
    fetchPreferredEquity();
    
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
  }, [fetchTrades, fetchMarketplace, fetchMiniCmbs, fetchParticipations, fetchPreferredEquity, notify]);

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
      const fieldDefs = [...COMMON_FIELDS, ...(definition.fields || [])];
      const validation = validateValues(definition, fieldDefs, values);
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
        await api.post('/trades', buildPayload(definition, values));
        notify('Trade submitted');
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
    [fetchTrades, forms, notify, resetForm]
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

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Trades</h1>
      {toast && (
       <div className="fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-md">
          {toast}
        </div>
      )}
      <section className="mb-8">
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
      </section>
      <MiniCmbsPools pools={cmbsPools} onRefresh={fetchMiniCmbs} onNotify={notify} />
      <ParticipationMarketplace listings={participations} onRefresh={fetchParticipations} onNotify={notify} />
      <PreferredEquityTokens tokens={preferredEquity} onRefresh={fetchPreferredEquity} onNotify={notify} />
    </div>
  );
}
