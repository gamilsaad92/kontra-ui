import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

type Offering = { id: string; status: string };

type Rfq = {
  id: string;
  requested_amount: number;
  requested_price_value: number | null;
  status: string;
  message?: string | null;
};

type Trade = {
  id: string;
  amount: number;
  status: string;
  settlement_ref?: string | null;
};

export default function RfqsTrades() {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selectedOffering, setSelectedOffering] = useState("");
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [requestedAmount, setRequestedAmount] = useState(500000);
  const [requestedPriceValue, setRequestedPriceValue] = useState(1);
  const [rfqMessage, setRfqMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const loadOfferings = async () => {
    const response = await api.get("/market/offerings");
    setOfferings(response.data.offerings || []);
  };

  const loadTrades = async () => {
    const response = await api.get("/market/trades");
    setTrades(response.data.trades || []);
  };

  const loadRfqs = async (offeringId: string) => {
    if (!offeringId) return;
    const response = await api.get(`/market/offerings/${offeringId}`);
    setRfqs(response.data.rfqs || []);
  };

  useEffect(() => {
    loadOfferings();
    loadTrades();
  }, []);

  useEffect(() => {
    loadRfqs(selectedOffering);
  }, [selectedOffering]);

  const handleSubmitRfq = async () => {
    if (!selectedOffering) return;
    setStatus(null);
    try {
      await api.post(`/market/offerings/${selectedOffering}/rfq`, {
        requested_amount: requestedAmount,
        requested_price_value: requestedPriceValue,
        message: rfqMessage,
      });
      setStatus("RFQ submitted.");
      setRfqMessage("");
      loadRfqs(selectedOffering);
    } catch (err: any) {
      setStatus(err?.response?.data?.message || "Unable to submit RFQ");
    }
  };

  const handleCounter = async (rfqId: string) => {
    setStatus(null);
    try {
      await api.post(`/market/rfq/${rfqId}/counter`, {
        requested_price_value: requestedPriceValue,
        message: "Countered terms attached.",
      });
      setStatus("RFQ counter sent.");
      loadRfqs(selectedOffering);
    } catch (err: any) {
      setStatus(err?.response?.data?.message || "Unable to counter RFQ");
    }
  };

  const handleAccept = async (rfqId: string) => {
    setStatus(null);
    try {
      await api.post(`/market/rfq/${rfqId}/accept`);
      setStatus("RFQ accepted and trade created.");
      loadRfqs(selectedOffering);
      loadTrades();
    } catch (err: any) {
      setStatus(err?.response?.data?.message || "Unable to accept RFQ");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">RFQ intake</h2>
        <p className="mt-2 text-sm text-slate-600">
          Buyers submit negotiated RFQs; sellers counter or accept to create trades.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-600">
            Offering
            <select
              value={selectedOffering}
              onChange={(event) => setSelectedOffering(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="">Select offering</option>
              {offerings.map((offering) => (
                <option key={offering.id} value={offering.id}>
                  {offering.id} · {offering.status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Requested amount
            <input
              type="number"
              value={requestedAmount}
              onChange={(event) => setRequestedAmount(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-600">
            Requested price
            <input
              type="number"
              value={requestedPriceValue}
              onChange={(event) => setRequestedPriceValue(Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-600">
            Message
            <input
              type="text"
              value={rfqMessage}
              onChange={(event) => setRfqMessage(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={handleSubmitRfq}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Submit RFQ
        </button>
        {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Current RFQs</h3>
        <div className="mt-4 space-y-3">
          {rfqs.map((rfq) => (
            <div key={rfq.id} className="rounded-lg border border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">RFQ {rfq.id}</p>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{rfq.status}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleCounter(rfq.id)}
                    className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-600"
                  >
                    Counter
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAccept(rfq.id)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Accept
                  </button>
                </div>
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Amount: {rfq.requested_amount} · Price: {rfq.requested_price_value ?? "—"}
              </div>
              {rfq.message ? <p className="mt-1 text-xs text-slate-500">{rfq.message}</p> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Trades</h3>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          {trades.map((trade) => (
            <div key={trade.id} className="rounded-lg border border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Trade {trade.id}</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">{trade.status}</p>
              <p className="mt-1">Amount: {trade.amount}</p>
              <p className="text-xs text-slate-500">Settlement ref: {trade.settlement_ref ?? "—"}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
