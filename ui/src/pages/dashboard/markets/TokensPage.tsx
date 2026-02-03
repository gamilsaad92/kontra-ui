import { useEffect, useState, type ReactNode } from "react";
import {
  capitalMarketsApi,
  type CmAllocation,
  type CmEvent,
  type CmToken,
} from "../../../lib/capitalMarketsApi";

const holderOptions = ["wallet", "borrower", "lender", "investor", "internal"] as const;

export default function TokensPage() {
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState<CmToken[]>([]);
  const [selected, setSelected] = useState<CmToken | null>(null);
  const [detail, setDetail] = useState<{ allocations: CmAllocation[]; events: CmEvent[] } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [mintOpen, setMintOpen] = useState(false);
  const [burnOpen, setBurnOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await capitalMarketsApi.listTokens();
      setTokens(res.tokens || []);
    } finally {
      setLoading(false);
    }
  };

  const openToken = async (token: CmToken) => {
    setSelected(token);
    const [tokenRes, eventsRes] = await Promise.all([
      capitalMarketsApi.getToken(token.id),
      capitalMarketsApi.getEvents(token.id),
    ]);
    setSelected(tokenRes.token);
    setDetail({ allocations: tokenRes.allocations || [], events: eventsRes.events || [] });
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Tokens</h2>
          <p className="text-sm text-slate-600">Create tokens, issue supply, and manage allocations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={refresh}
            disabled={loading}
          >
            Refresh
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            onClick={() => setCreateOpen(true)}
          >
            Create Token
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          Token Registry
        </div>
        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-600">Loading…</div>
        ) : tokens.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-600">
            No tokens yet. Click <span className="font-semibold text-slate-800">Create Token</span> to add your first
            one.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Symbol</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Supply</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tokens.map((token) => (
                <tr key={token.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{token.symbol}</td>
                  <td className="px-4 py-3 text-slate-700">{token.name}</td>
                  <td className="px-4 py-3 text-slate-700">{Number(token.total_supply).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-700">{token.status}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => openToken(token)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected ? (
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">
                {selected.symbol} — {selected.name}
              </div>
              <div className="text-sm text-slate-600">
                Total supply: <span className="font-semibold text-slate-800">{Number(selected.total_supply).toLocaleString()}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setMintOpen(true)}
              >
                Mint
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setBurnOpen(true)}
              >
                Burn
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => setTransferOpen(true)}
              >
                Transfer
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setSelected(null);
                  setDetail(null);
                }}
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-100 p-3">
              <div className="mb-2 text-sm font-semibold text-slate-800">Allocations</div>
              {!detail ? (
                <div className="text-sm text-slate-600">Loading…</div>
              ) : detail.allocations.length === 0 ? (
                <div className="text-sm text-slate-600">No allocations yet.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-2">Holder</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.allocations.map((allocation) => (
                      <tr key={allocation.id}>
                        <td className="px-2 py-2 text-slate-700">{allocation.holder_ref}</td>
                        <td className="px-2 py-2 text-slate-700">{allocation.holder_type}</td>
                        <td className="px-2 py-2 text-right text-slate-700">
                          {Number(allocation.balance).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="rounded-lg border border-slate-100 p-3">
              <div className="mb-2 text-sm font-semibold text-slate-800">Event History</div>
              {!detail ? (
                <div className="text-sm text-slate-600">Loading…</div>
              ) : detail.events.length === 0 ? (
                <div className="text-sm text-slate-600">No events yet.</div>
              ) : (
                <div className="flex max-h-64 flex-col gap-2 overflow-auto">
                  {detail.events.map((event) => (
                    <div key={event.id} className="rounded-lg border border-slate-100 p-2">
                      <div className="text-xs font-semibold text-slate-800">
                        {event.event_type.toUpperCase()} — {Number(event.amount).toLocaleString()}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {new Date(event.created_at).toLocaleString()}
                        {event.from_holder_ref ? ` • from ${event.from_holder_ref}` : ""}
                        {event.to_holder_ref ? ` • to ${event.to_holder_ref}` : ""}
                      </div>
                      {event.memo ? <div className="mt-1 text-xs text-slate-600">{event.memo}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <CreateTokenModal
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refresh();
          }}
        />
      ) : null}

      {selected && mintOpen ? (
        <MintBurnModal
          title={`Mint ${selected.symbol}`}
          onClose={() => setMintOpen(false)}
          onSubmit={async (payload) => {
            await capitalMarketsApi.mint(selected.id, payload);
            await openToken(selected);
            await refresh();
            setMintOpen(false);
          }}
        />
      ) : null}

      {selected && burnOpen ? (
        <MintBurnModal
          title={`Burn ${selected.symbol}`}
          onClose={() => setBurnOpen(false)}
          onSubmit={async (payload) => {
            await capitalMarketsApi.burn(selected.id, payload);
            await openToken(selected);
            await refresh();
            setBurnOpen(false);
          }}
        />
      ) : null}

      {selected && transferOpen ? (
        <TransferModal
          title={`Transfer ${selected.symbol}`}
          onClose={() => setTransferOpen(false)}
          onSubmit={async (payload) => {
            await capitalMarketsApi.transfer(selected.id, payload);
            await openToken(selected);
            setTransferOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function CreateTokenModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [decimals, setDecimals] = useState(0);
  const [saving, setSaving] = useState(false);

  return (
    <ModalFrame onClose={onClose} title="Create Token">
      <div className="space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Symbol
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            placeholder="e.g. RWA01"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Name
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Georgetown Senior Note"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Decimals
          <input
            type="number"
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={decimals}
            onChange={(event) => setDecimals(Number(event.target.value))}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={saving || !symbol.trim() || !name.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                await capitalMarketsApi.createToken({ symbol, name, decimals });
                await onCreated();
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

function MintBurnModal({
  title,
  onClose,
  onSubmit,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (payload: { holder_type: string; holder_ref: string; amount: number; memo?: string }) => Promise<void>;
}) {
  const [holderType, setHolderType] = useState<typeof holderOptions[number]>("wallet");
  const [holderRef, setHolderRef] = useState("");
  const [amount, setAmount] = useState(0);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <ModalFrame onClose={onClose} title={title}>
      <div className="space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Holder Type
          <select
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={holderType}
            onChange={(event) => setHolderType(event.target.value as typeof holderOptions[number])}
          >
            {holderOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Holder Reference
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={holderRef}
            onChange={(event) => setHolderRef(event.target.value)}
            placeholder="0x… or investor_123"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Amount
          <input
            type="number"
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Memo (optional)
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="Issuance for Loan #…"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={saving || !holderRef.trim() || amount <= 0}
            onClick={async () => {
              setSaving(true);
              try {
                await onSubmit({
                  holder_type: holderType,
                  holder_ref: holderRef,
                  amount,
                  memo: memo.trim() || undefined,
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

function TransferModal({
  title,
  onClose,
  onSubmit,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (payload: {
    from: { holder_type: string; holder_ref: string };
    to: { holder_type: string; holder_ref: string };
    amount: number;
    memo?: string;
  }) => Promise<void>;
}) {
  const [fromType, setFromType] = useState<typeof holderOptions[number]>("wallet");
  const [fromRef, setFromRef] = useState("");
  const [toType, setToType] = useState<typeof holderOptions[number]>("wallet");
  const [toRef, setToRef] = useState("");
  const [amount, setAmount] = useState(0);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <ModalFrame onClose={onClose} title={title}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            From Type
            <select
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={fromType}
              onChange={(event) => setFromType(event.target.value as typeof holderOptions[number])}
            >
              {holderOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            To Type
            <select
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={toType}
              onChange={(event) => setToType(event.target.value as typeof holderOptions[number])}
            >
              {holderOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          From Reference
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={fromRef}
            onChange={(event) => setFromRef(event.target.value)}
            placeholder="0x… or investor_123"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          To Reference
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={toRef}
            onChange={(event) => setToRef(event.target.value)}
            placeholder="0x… or investor_999"
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Amount
          <input
            type="number"
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
          />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Memo (optional)
          <input
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={saving || !fromRef.trim() || !toRef.trim() || amount <= 0}
            onClick={async () => {
              setSaving(true);
              try {
                await onSubmit({
                  from: { holder_type: fromType, holder_ref: fromRef },
                  to: { holder_type: toType, holder_ref: toRef },
                  amount,
                  memo: memo.trim() || undefined,
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Submitting…" : "Transfer"}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

function ModalFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <button
            type="button"
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
