import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";

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

// ── Securities exemption types ────────────────────────────────────────────────
const EXEMPTIONS = [
  {
    value: "reg_d_506b",
    label: "Reg D 506(b)",
    sub: "Up to 35 non-accredited + unlimited accredited investors. No general solicitation. Pre-existing relationship required.",
    requiresAccredited: false,
    allowsSolicitation: false,
    jurisdictions: ["US"],
    investorTypes: ["institutional", "accredited_individual", "family_office", "reit", "pension_fund"],
  },
  {
    value: "reg_d_506c",
    label: "Reg D 506(c)",
    sub: "General solicitation and advertising allowed. ALL investors must be verified accredited. Third-party verification required.",
    requiresAccredited: true,
    allowsSolicitation: true,
    jurisdictions: ["US"],
    investorTypes: ["institutional", "accredited_individual", "qualified_purchaser", "family_office", "reit", "pension_fund"],
  },
  {
    value: "reg_s",
    label: "Reg S",
    sub: "Offshore transaction exemption. US persons excluded. No directed selling efforts into the US. 12-month restricted period.",
    requiresAccredited: false,
    allowsSolicitation: false,
    jurisdictions: ["GB", "EU", "SG", "HK", "CA", "AU"],
    investorTypes: ["institutional", "family_office", "pension_fund"],
  },
  {
    value: "rule_144a",
    label: "Rule 144A",
    sub: "Resale to Qualified Institutional Buyers (QIBs) only. Minimum $100M AUM. PORTAL-eligible. No retail investors.",
    requiresAccredited: true,
    allowsSolicitation: true,
    jurisdictions: ["US"],
    investorTypes: ["institutional", "reit", "pension_fund"],
  },
];

export default function CreateOffering() {
  const [tokenizedAssets, setTokenizedAssets] = useState<TokenizedAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState("");
  const [exemptionType, setExemptionType] = useState("reg_d_506b");
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

  const selectedExemption = EXEMPTIONS.find(e => e.value === exemptionType) || EXEMPTIONS[0];

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
        securities_exemption: exemptionType,
        allowed_jurisdictions: selectedExemption.jurisdictions,
        allowed_investor_types: selectedExemption.investorTypes,
        requires_accredited: selectedExemption.requiresAccredited,
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

      {/* Step A — Asset */}
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

      {/* Step B — Securities exemption (NEW) */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Step B · Securities exemption</h2>
        <p className="mt-1 text-sm text-slate-500">
          Select the applicable US securities law exemption. This determines allowed investor types, jurisdictions, and solicitation rules. Kontra gates the whitelist automatically based on your selection.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {EXEMPTIONS.map(ex => (
            <button
              key={ex.value}
              type="button"
              onClick={() => setExemptionType(ex.value)}
              className={`text-left rounded-xl border p-4 transition-all ${exemptionType === ex.value ? "border-indigo-500 bg-white shadow-sm ring-2 ring-indigo-200" : "border-slate-200 bg-white hover:border-slate-300"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-900">{ex.label}</span>
                {exemptionType === ex.value && (
                  <span className="rounded-full bg-indigo-600 text-white text-xs px-2 py-0.5 font-semibold">Selected</span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{ex.sub}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {ex.jurisdictions.map(j => (
                  <span key={j} className="rounded bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 font-mono">{j}</span>
                ))}
                {ex.requiresAccredited && (
                  <span className="rounded bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 font-semibold">Accredited only</span>
                )}
                {ex.allowsSolicitation && (
                  <span className="rounded bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0.5 font-semibold">General solicitation</span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Gating summary */}
        <div className="mt-4 rounded-lg border border-indigo-200 bg-white p-4">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Automatic gates for {selectedExemption.label}</p>
          <ul className="space-y-1 text-xs text-slate-600">
            <li>• Allowed jurisdictions: <span className="font-semibold">{selectedExemption.jurisdictions.join(", ")}</span></li>
            <li>• Allowed investor types: <span className="font-semibold">{selectedExemption.investorTypes.map(t => t.replace(/_/g, " ")).join(", ")}</span></li>
            <li>• Requires accredited verification: <span className="font-semibold">{selectedExemption.requiresAccredited ? "Yes — third-party verification required" : "No"}</span></li>
            <li>• General solicitation: <span className="font-semibold">{selectedExemption.allowsSolicitation ? "Permitted" : "Prohibited — pre-existing relationships only"}</span></li>
            {exemptionType === "reg_s" && <li className="text-amber-700 font-semibold">• US persons are excluded from this offering</li>}
            {exemptionType === "rule_144a" && <li className="text-amber-700 font-semibold">• Minimum QIB threshold: $100M AUM per investor</li>}
          </ul>
        </div>
      </div>

      {/* Step C — Offering terms */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Step C · Offering terms</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-600">
            Offering type
            <select value={offeringType} onChange={(event) => setOfferingType(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
              <option value="fixed">Fixed</option>
              <option value="rfq">RFQ / Negotiated</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Pricing type
            <select value={priceType} onChange={(event) => setPriceType(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
              <option value="par">Par</option>
              <option value="premium">Premium</option>
              <option value="discount">Discount</option>
              <option value="yield">Yield</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Min ticket
            <input type="number" value={minTicket} onChange={(event) => setMinTicket(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          <label className="text-sm text-slate-600">
            Max ticket
            <input type="number" value={maxTicket} onChange={(event) => setMaxTicket(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          <label className="text-sm text-slate-600">
            Price value
            <input type="number" value={priceValue} onChange={(event) => setPriceValue(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          <label className="text-sm text-slate-600">
            Target yield (bps)
            <input type="number" value={targetYield} onChange={(event) => setTargetYield(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          <label className="text-sm text-slate-600">
            Start date
            <input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          <label className="text-sm text-slate-600">
            End date
            <input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
        </div>
        <button type="button" onClick={handleCreateOffering} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          Create draft offering
        </button>
      </div>

      {/* Step D — Whitelist */}
      <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${!offeringId ? "opacity-50 pointer-events-none" : ""}`}>
        <h2 className="text-lg font-semibold text-slate-900">Step D · Whitelist access</h2>
        {!offeringId && <p className="mt-1 text-xs text-slate-400">Create the offering draft first to enable whitelist.</p>}
        <div className="mt-2 mb-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600">
          <span className="font-semibold">Active exemption: {selectedExemption.label}</span> — 
          {exemptionType === "reg_s" ? " US persons cannot be added to this whitelist." : 
           exemptionType === "rule_144a" ? " Only QIBs ($100M+ AUM) may be whitelisted." :
           selectedExemption.requiresAccredited ? " All entries must be verified accredited investors." :
           " Pre-existing relationship with investor required (no cold solicitation)."}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-600">
            Access type
            <select value={accessType} onChange={(event) => setAccessType(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">
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
        <button type="button" onClick={handleAddWhitelist} className="mt-4 rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
          Add whitelist entry
        </button>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          {whitelist.map((entry) => (
            <div key={entry.id} className="rounded-md bg-slate-50 px-3 py-2 flex items-center justify-between">
              <span>{entry.access_type} · {entry.org_id || entry.wallet_address || entry.group_key}</span>
              <span className="text-xs text-emerald-600 font-semibold">✓ {selectedExemption.label} compliant</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step E — Disclosure */}
      <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${!offeringId ? "opacity-50 pointer-events-none" : ""}`}>
        <h2 className="text-lg font-semibold text-slate-900">Step E · Generate disclosure pack</h2>
        <p className="mt-2 text-sm text-slate-600">
          Disclosure packs compile loan snapshots, servicing status, covenant exceptions, and the <span className="font-semibold">{selectedExemption.label}</span> PPM/offering memorandum into a single package. Listing is blocked until this is complete.
        </p>
        <button type="button" onClick={handleGenerateDisclosure} className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Generate disclosure pack
        </button>
      </div>

      {/* Step F — Submit */}
      <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${!offeringId ? "opacity-50 pointer-events-none" : ""}`}>
        <h2 className="text-lg font-semibold text-slate-900">Step F · Submit for approval</h2>
        <p className="mt-2 text-sm text-slate-600">
          Compliance/admin approval is required before the offering can be listed. Securities counsel must sign off on the <span className="font-semibold">{selectedExemption.label}</span> exemption filing.
        </p>
        <button type="button" onClick={handleSubmitApproval} className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          Submit for approval
        </button>
        {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
      </div>
    </div>
  );
}
