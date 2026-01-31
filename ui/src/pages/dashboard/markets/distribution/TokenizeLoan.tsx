import { useState } from "react";
import { api } from "../../../../lib/api";

const defaultMetadata = {
  collateral_summary: { type: "Multifamily", occupancy: "94%" },
  servicing_status: { status: "Current", servicer: "Kontra Servicing" },
  dscr_noi_history: [],
  escrow: { taxes: "current", insurance: "current" },
  inspections: [],
  hazard_loss: [],
  covenant_exceptions: [],
};

export default function TokenizeLoan() {
  const [loanId, setLoanId] = useState("");
  const [assetType, setAssetType] = useState("loan");
  const [tokenSymbol, setTokenSymbol] = useState("CRDT");
  const [tokenName, setTokenName] = useState("Credit Token");
  const [chain, setChain] = useState("testnet");
  const [totalSupply, setTotalSupply] = useState(1000000);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const response = await api.post("/market/tokenize", {
        loan_id: Number(loanId),
        asset_type: assetType,
        token_symbol: tokenSymbol,
        token_name: tokenName,
        chain,
        total_supply: totalSupply,
        metadata: defaultMetadata,
      });
      setStatus(`Tokenized asset created: ${response.data.tokenized_asset.id}`);
    } catch (err: any) {
      setStatus(err?.response?.data?.message || "Unable to create tokenized asset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Step A · Select loan</h2>
          <p className="mt-1 text-sm text-slate-600">
            Enter the servicing loan ID to snapshot the current credit state.
          </p>
          <input
            type="number"
            value={loanId}
            onChange={(event) => setLoanId(event.target.value)}
            placeholder="Loan ID"
            className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Step B · Token terms</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm text-slate-600">
              Asset type
              <select
                value={assetType}
                onChange={(event) => setAssetType(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="loan">Whole loan</option>
                <option value="tranche">Tranche</option>
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Chain
              <select
                value={chain}
                onChange={(event) => setChain(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="ethereum">Ethereum</option>
                <option value="polygon">Polygon</option>
                <option value="solana">Solana</option>
                <option value="testnet">Testnet</option>
              </select>
            </label>
            <label className="text-sm text-slate-600">
              Token symbol
              <input
                type="text"
                value={tokenSymbol}
                onChange={(event) => setTokenSymbol(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-600">
              Token name
              <input
                type="text"
                value={tokenName}
                onChange={(event) => setTokenName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-600">
              Total supply
              <input
                type="number"
                value={totalSupply}
                onChange={(event) => setTotalSupply(Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Step C · Create draft</h2>
          <p className="mt-1 text-sm text-slate-600">
            Drafts stay off-chain until compliance approval and final mint.
          </p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create tokenized asset"}
          </button>
          {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
            Loan snapshot
          </h3>
          <p className="mt-2 text-sm text-slate-700">
            Snapshot will appear after you select a loan. Include servicing metrics, collateral
            health, and covenant exceptions for the disclosure pack generator.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-600">
            <li>• DSCR & NOI history</li>
            <li>• Escrow balances & insurance</li>
            <li>• Inspection schedule</li>
            <li>• Hazard loss history</li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Compliance reminders
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Drafts are private by default. No offering can list without approvals, disclosures,
            and whitelist assignment.
          </p>
        </div>
      </div>
    </div>
  );
}
