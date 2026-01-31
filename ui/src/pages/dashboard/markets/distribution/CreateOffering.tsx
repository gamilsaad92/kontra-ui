import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

type TokenizedAsset = {
  id: string;
  token_symbol: string;
  token_name: string;
  status: string;
};

type OfferingAccess = {
  id: string;
  access_type: string;
  org_id?: string | null;
  wallet_address?: string | null;
  group_key?: string | null;
};

export default function CreateOffering() {
  const [tokenizedAssets, setTokenizedAssets] = useState<TokenizedAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState("");
  const [offeringType, setOfferingType] = useState("rfq");
  const [minTicket, setMinTicket] = useState(250000);
  const [maxTicket, setMaxTicket] = useState(2500000);
  const [priceType, setPriceType] = useState("par");
  const [priceValue, setPriceValue] = useState(1);
  const [targetYield, setTargetYield] = useState(850);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [accessType, setAccessType] = useState("org");
  const [orgId, setOrgId] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [groupKey, setGroupKey] = useState("");
  const [whitelist, setWhitelist] = useState<OfferingAccess[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/market/tokenized-assets")
      .then((response) => setTokenizedAssets(response.data.tokenized_assets || []))
      .catch(() => setTokenizedAssets([]));
  }, []);

  const handleCreateOffering = async () => {
    setStatus(null);
    try {
      const response = await api.post("/market/offerings", {
        tokenized_asset_id: selectedAsset,
        offering_type: offeringType,
        min_ticket: minTicket,
        max_ticket: maxTicket,
        price_type: priceType,
        price_value: priceValue,
        target_yield_bps: targetYield,
        starts_at: startsAt || null,
        ends_at: endsAt || null,
      });
      setOfferingId(response.data.offering.id);
      setStatus(`Offering draft created: ${response.data.offering.id}`);
    } catch (err: any) {
      setStatus(err?.response?.data?.message || "Unable to create offering");
    }
  };

  const handleAddWhitelist = async () => {
    if (!offeringId) return;
    setStatus(null);
    try {
      const response = await api.post(`/market/offerings/${offeringId}/access`, {
        access_type: accessType,
        org_id: orgId || null,
        wallet_address: walletAddress || null,
        group_key: groupKey || null,
      });
      setWhitelist((prev) => [...prev, response.data.access]);
      setOrgId("");
      setWalletAddress("");
      setGroupKey("");
    } catch (err: any) {
      setStatus(err?.response?.data?.message || "Unable to add whitelist entry");
    }
  };

  const handleGenerateDisclosure = async () => {
    if (!offeringId) return;
    setStatus(null);
    try {
      const response = await api.post(`/market/offerings/${offeringId}/disclosures/generate`);
      setStatus(`Disclosure pack generated: ${response.data.disclosure_pack_url}`);
    } catch (err: any) {
      setStatus(err?.response?.data?.message || "Unable to generate disclosure pack");
    }
  };

  const handleSubmitApproval = async () => {
    if (!offeringId) return;
    setStatus(null);
    try {
      const response = await api.post(`/market/offerings/${offeringId}/submit`);
      setStatus(`Submitted for approval: ${response.data.offering.status}`);
    } catch (err: any) {
      setStatus(err?.response?.data?.message || "Unable to submit offering");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Step A · Select tokenized asset</h2>
        <select
          value={selectedAsset}
          onChange={(event) => setSelectedAsset(event.target.value)}
          className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">Select an asset</option>
          {tokenizedAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.token_symbol} · {asset.token_name} ({asset.status})
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Step B · Offering terms</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-600">
            Offering type
            <select
              value={offeringType}
              onChange={(event) => setOfferingType(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="fixed">Fixed</option>
              <option value="rfq">RFQ / Negotiated</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Pricing type
            <select
              value={priceType}
              onChange={(event) => setPriceType(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="par">Par</option>
              <option value="premium">Premium</option>
              <option value="discount">Discount</option>
              <option value="yield">Yield</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Min ticket
            <input
              type="number"
              value={minTicket}
              onChange={(event) => setMinTicket(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-600">
            Max ticket
            <input
              type="number"
              value={maxTicket}
              onChange={(event) => setMaxTicket(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-600">
            Price value
            <input
              type="number"
              value={priceValue}
              onChange={(event) => setPriceValue(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-600">
            Target yield (bps)
            <input
              type="number"
              value={targetYield}
              onChange={(event) => setTargetYield(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-600">
            Start date
            <input
              type="date"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-600">
            End date
            <input
              type="date"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleCreateOffering}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Create draft offering
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Step C · Whitelist access</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-600">
            Access type
            <select
              value={accessType}
              onChange={(event) => setAccessType(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="org">Organization</option>
              <option value="wallet">Wallet</option>
              <option value="whitelist_group">Group</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Org ID / Wallet / Group
            <input
              type="text"
              value={accessType === "org" ? orgId : accessType === "wallet" ? walletAddress : groupKey}
              onChange={(event) => {
                const value = event.target.value;
                if (accessType === "org") setOrgId(value);
                if (accessType === "wallet") setWalletAddress(value);
                if (accessType === "whitelist_group") setGroupKey(value);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleAddWhitelist}
          className="mt-4 rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-600"
        >
          Add whitelist entry
        </button>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          {whitelist.map((entry) => (
            <div key={entry.id} className="rounded-md bg-slate-50 px-3 py-2">
              {entry.access_type} · {entry.org_id || entry.wallet_address || entry.group_key}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Step D · Generate disclosure pack</h2>
        <p className="mt-2 text-sm text-slate-600">
          Disclosure packs compile loan snapshots, servicing status, and covenant exceptions into a
          single package. Listing is blocked until this is available.
        </p>
        <button
          type="button"
          onClick={handleGenerateDisclosure}
          className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Generate disclosure pack
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Step E · Submit for approval</h2>
        <p className="mt-2 text-sm text-slate-600">
          Compliance/admin approval is required before the offering can be listed.
        </p>
        <button
          type="button"
          onClick={handleSubmitApproval}
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Submit for approval
        </button>
        {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
      </div>
    </div>
  );
}
