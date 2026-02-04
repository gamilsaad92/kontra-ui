import { useEffect, useMemo, useState } from "react";
import {
  stablecoinPaymentsApi,
  type StablecoinEvent,
  type StablecoinPayment,
} from "../lib/stablecoinPaymentsApi";

const formatNumber = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);

const statusTone = (status: string) => {
  switch (status) {
    case "requested":
      return "bg-slate-100 text-slate-700";
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "settled":
    case "reconciled":
      return "bg-emerald-100 text-emerald-700";
    case "flagged":
    case "failed":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

export default function StablecoinPaymentsPanel() {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<StablecoinPayment[]>([]);
  const [selected, setSelected] = useState<StablecoinPayment | null>(null);
  const [detail, setDetail] = useState<{ payment: StablecoinPayment; events: StablecoinEvent[] } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await stablecoinPaymentsApi.list();
      setPayments(res.payments || []);
    } finally {
      setLoading(false);
    }
  };

  const open = async (payment: StablecoinPayment) => {
    setSelected(payment);
    const res = await stablecoinPaymentsApi.get(payment.id);
    setDetail(res);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Stablecoin payments</h3>
          <p className="text-sm text-slate-500">
            USDC on Base via custodial rails · default auto-convert to USD
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Create USDC payment request
          </button>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
          Requests
        </div>
        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">Loading…</div>
        ) : payments.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">No stablecoin requests yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{payment.reference}</p>
                  <p className="text-xs text-slate-500">Created {new Date(payment.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-700">
                    {formatNumber(Number(payment.expected_amount))} {payment.token}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(payment.status)}`}>
                    {payment.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => open(payment)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && detail ? (
        <StablecoinPaymentDrawer
          data={detail}
          onClose={() => {
            setSelected(null);
            setDetail(null);
          }}
        />
      ) : null}

      {createOpen ? (
        <CreateStablecoinPaymentModal
          onClose={() => setCreateOpen(false)}
          onCreated={async (payment) => {
            setCreateOpen(false);
            await refresh();
            await open(payment);
          }}
        />
      ) : null}
    </section>
  );
}

function StablecoinPaymentDrawer({
  data,
  onClose,
}: {
  data: { payment: StablecoinPayment; events: StablecoinEvent[] };
  onClose: () => void;
}) {
  const payment = data.payment;
  const payText = `USDC on Base\nAddress: ${payment.destination_address}\nAmount: ${payment.expected_amount}\nRef: ${payment.reference}`;
  const qrUrl = useMemo(() => {
    const payload = encodeURIComponent(payText);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${payload}`;
  }, [payText]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Stablecoin request</p>
            <h4 className="text-lg font-semibold text-slate-900">{payment.reference}</h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            "USDC",
            "Base",
            `Status: ${payment.status}`,
            `Auto-convert: ${payment.auto_convert_to_usd ? "ON" : "OFF"}`,
          ].map((label) => (
            <span
              key={label}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
            >
              {label}
            </span>
          ))}
        </div>

        <div className="mt-6 grid gap-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <h5 className="text-sm font-semibold text-slate-700">Payment instructions</h5>
            <div className="mt-3 grid gap-2 text-sm text-slate-600">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Address</p>
                  <p className="break-all font-medium text-slate-900">{payment.destination_address}</p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                  onClick={() => navigator.clipboard.writeText(payment.destination_address)}
                >
                  Copy address
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Amount</p>
                  <p className="font-medium text-slate-900">
                    {formatNumber(Number(payment.expected_amount))} USDC
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                  onClick={() => navigator.clipboard.writeText(String(payment.expected_amount))}
                >
                  Copy amount
                </button>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Network</p>
                <p className="font-medium text-slate-900">Base</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Reference</p>
                <p className="font-medium text-slate-900">{payment.reference}</p>
              </div>
              {payment.tx_hash ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Transaction</p>
                  <p className="break-all font-medium text-slate-900">{payment.tx_hash}</p>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                onClick={() => navigator.clipboard.writeText(payText)}
              >
                Copy full instructions
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Send only USDC on Base. Other networks or mismatched amounts will be flagged.
            </p>
            <div className="mt-4 flex items-center justify-center rounded-lg bg-slate-50 p-4">
              <img src={qrUrl} alt="USDC payment QR code" className="h-44 w-44" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h5 className="text-sm font-semibold text-slate-700">Audit events</h5>
            <div className="mt-3 space-y-2">
              {data.events.length === 0 ? (
                <p className="text-sm text-slate-500">No events yet.</p>
              ) : (
                data.events.map((event) => (
                  <div key={event.id} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-800">{event.event_type}</p>
                      <span className="text-xs text-slate-400">
                        {new Date(event.created_at).toLocaleString()}
                      </span>
                    </div>
                    {event.old_status ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {event.old_status} → {event.new_status}
                      </p>
                    ) : null}
                    {event.tx_hash ? (
                      <p className="mt-2 break-all text-xs text-slate-500">Tx: {event.tx_hash}</p>
                    ) : null}
                    {typeof event.amount === "number" ? (
                      <p className="mt-1 text-xs text-slate-500">Amount: {event.amount}</p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateStablecoinPaymentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (payment: StablecoinPayment) => void;
}) {
  const [amount, setAmount] = useState<number>(0);
  const [autoConvert, setAutoConvert] = useState(true);
  const [expires, setExpires] = useState(1440);
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-slate-900">Create USDC payment request</h4>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-600"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-4 text-sm text-slate-600">
          <label className="grid gap-2">
            Amount (USDC)
            <input
              type="number"
              min={0}
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoConvert}
              onChange={(event) => setAutoConvert(event.target.checked)}
            />
            Auto-convert to USD after settlement (recommended)
          </label>

          <label className="grid gap-2">
            Expires in (minutes)
            <input
              type="number"
              min={5}
              value={expires}
              onChange={(event) => setExpires(Number(event.target.value))}
              className="rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || amount <= 0}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={async () => {
              setSaving(true);
              try {
                const res = await stablecoinPaymentsApi.create({
                  expected_amount: amount,
                  auto_convert_to_usd: autoConvert,
                  expires_in_minutes: expires,
                });
                onCreated(res.payment);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
