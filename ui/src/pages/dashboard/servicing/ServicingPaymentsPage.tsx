import { useEffect, useMemo, useState } from "react";
import type { AiReview, AiReviewStatus } from "../../../features/ai-reviews/types";
import {
  approveAction,
  getReviews,
  markReview,
  reviewPayment,
} from "../../../features/ai-reviews/api";

export default function ServicingPaymentsPage() {
 const [statusFilter, setStatusFilter] = useState<AiReviewStatus | "all">("all");
  const [reviews, setReviews] = useState<AiReview[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState("");
  const [allocation, setAllocation] = useState<Record<string, number>>({});

  const mockReviews: AiReview[] = [
    {
      id: "mock-payment-1",
      org_id: "org-1",
      project_id: "project-9",
      loan_id: "loan-204",
      type: "payment",
      source_id: "payment-771",
      status: "needs_review",
      confidence: 0.58,
      title: "Payment exception: Received amount is short by $3,200.",
      summary: "Payment requires human review before posting or borrower communication.",
      reasons: [
        {
          code: "short_pay",
          message: "Received amount is short by $3,200.",
          severity: "high",
        },
      ],
      evidence: [
        {
          label: "Remittance advice",
          url: "https://example.com/remittance-771.pdf",
          kind: "document",
        },
      ],
      recommended_actions: [
        {
          action_type: "approve_posting",
          label: "Approve posting proposal",
          payload: { allocation: { principal: 7200, interest: 1800, escrow: 500 } },
          requires_approval: true,
        },
        {
          action_type: "draft_borrower_email",
          label: "Draft borrower clarification email",
          payload: { remitterName: "QRS Capital" },
          requires_approval: true,
        },
      ],
      proposed_updates: {
        proposed_allocation: {
          principal: 7200,
          interest: 1800,
          escrow: 500,
          fees: 0,
          default_interest: 0,
          suspense: 0,
        },
        posting_notes: "Short pay flagged; hold in suspense pending confirmation.",
      },
      created_by: "ai",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const filteredReviews = useMemo(() => {
    if (statusFilter === "all") {
      return reviews;
    }
    return reviews.filter((review) => review.status === statusFilter);
  }, [reviews, statusFilter]);

  const selectedReview = useMemo(
    () => filteredReviews.find((review) => review.id === selectedId) ?? filteredReviews[0],
    [filteredReviews, selectedId]
  );

  useEffect(() => {
    setSelectedId(selectedReview?.id ?? null);
  }, [selectedReview?.id]);

  useEffect(() => {
    if (!selectedReview?.proposed_updates?.proposed_allocation) {
      setAllocation({});
      return;
    }
    setAllocation({ ...selectedReview.proposed_updates.proposed_allocation });
  }, [selectedReview]);

  const loadReviews = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await getReviews({
        type: "payment",
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setReviews(data);
      if (data.length === 0) {
        setReviews(mockReviews);
      }
    } catch (error) {
      setReviews(mockReviews);
      setMessage("Live AI reviews unavailable. Showing mock queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [statusFilter]);

  const handleRunReview = async () => {
    if (!paymentId) {
      setMessage("Enter a payment ID to run AI review.");
      return;
    }
    setMessage(null);
    try {
      const review = await reviewPayment(paymentId);
      setReviews((prev) => [review, ...prev]);
      setSelectedId(review.id);
      setPaymentId("");
    } catch (error) {
      setMessage("Unable to run AI review. Check backend configuration.");
    }
  };

  const handleMark = async (status: AiReviewStatus) => {
    if (!selectedReview) return;
    try {
      const updated = await markReview(selectedReview.id, status);
      setReviews((prev) => prev.map((review) => (review.id === updated.id ? updated : review)));
    } catch (error) {
      setMessage("Unable to update review status.");
    }
  };

  const handleApprovePosting = async () => {
    if (!selectedReview) return;
    try {
      const payload = {
        allocation,
        notes: selectedReview.proposed_updates?.posting_notes,
      };
      const response = await approveAction(
        selectedReview.id,
        "approve_posting",
        payload
      );
      setMessage(response?.message || "Approval recorded.");
    } catch (error) {
      setMessage("Unable to approve posting.");
    }
  };

  const handleAction = async (actionType: string, payload: Record<string, unknown>) => {
    if (!selectedReview) return;
    try {
      const response = await approveAction(selectedReview.id, actionType, payload);
      setMessage(response?.message || "Approval recorded.");
    } catch (error) {
      setMessage("Unable to approve action.");
    }
  };

  const statusBadgeClass = (status: AiReviewStatus) => {
    if (status === "pass") return "bg-emerald-100 text-emerald-700";
    if (status === "fail") return "bg-rose-100 text-rose-700";
    return "bg-amber-100 text-amber-700";
  };

  const allocationFields: Array<{ key: string; label: string }> = [
    { key: "principal", label: "Principal" },
    { key: "interest", label: "Interest" },
    { key: "escrow", label: "Escrow" },
    { key: "fees", label: "Fees" },
    { key: "default_interest", label: "Default interest" },
    { key: "suspense", label: "Suspense" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">AI Payment Ops</h2>
          <p className="text-sm text-slate-500">
            Triage AI payment reviews, validate posting proposals, and approve next-step actions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Payment ID"
            value={paymentId}
            onChange={(event) => setPaymentId(event.target.value)}
          />
          <button
            type="button"
            onClick={handleRunReview}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Run AI Review
          </button>
        </div>
      </header>

      {message ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,360px)]">
        <aside className="space-y-2">
          {["all", "needs_review", "pass", "fail"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status as AiReviewStatus | "all")}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold ${
                statusFilter === status
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 shadow-sm"
              }`}
            >
              {status === "needs_review"
                ? "Needs review"
                : status === "pass"
                  ? "Pass"
                  : status === "fail"
                    ? "Fail"
                    : "All"}
            </button>
          ))}
        </aside>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              Payment review queue
            </h3>
            <span className="text-xs text-slate-500">
              {loading ? "Refreshing…" : `${filteredReviews.length} items`}
            </span>
          </div>
          {filteredReviews.map((review) => (
            <button
              key={review.id}
              type="button"
              onClick={() => setSelectedId(review.id)}
              className={`w-full rounded-xl border px-4 py-3 text-left shadow-sm transition ${
                selectedReview?.id === review.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-900 hover:border-slate-400"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{review.title}</p>
                  <p className="text-xs opacity-70">Loan {review.loan_id ?? "—"}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    selectedReview?.id === review.id
                      ? "bg-white/20 text-white"
                      : statusBadgeClass(review.status)
                  }`}
                >
                  {review.status.replace("_", " ")}
                </span>
              </div>
            </button>
          ))}
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {selectedReview ? (
            <>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Review detail
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  {selectedReview.title}
                </h3>
                <p className="text-sm text-slate-600">{selectedReview.summary}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(selectedReview.status)}`}>
                    {selectedReview.status.replace("_", " ")}
                  </span>
                  <span className="text-xs text-slate-500">
                    Confidence {(selectedReview.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-700">Reasons</h4>
                <ul className="mt-2 space-y-1 text-sm text-slate-600">
                  {selectedReview.reasons.length === 0 ? (
                    <li>No exceptions detected.</li>
                  ) : (
                    selectedReview.reasons.map((reason) => (
                      <li key={reason.code} className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                          {reason.severity}
                        </span>
                        {reason.message}
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="text-sm font-semibold text-slate-700">
                  Proposed posting
                </h4>
                <div className="mt-3 grid gap-3">
                  {allocationFields.map((field) => (
                    <label key={field.key} className="flex items-center justify-between gap-3 text-sm text-slate-600">
                      <span>{field.label}</span>
                      <input
                        type="number"
                        className="w-28 rounded-md border border-slate-200 px-2 py-1 text-right text-sm"
                        value={Number(allocation[field.key] ?? 0)}
                        onChange={(event) =>
                          setAllocation((prev) => ({
                            ...prev,
                            [field.key]: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleApprovePosting}
                  className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Approve posting proposal
                </button>
                {selectedReview.proposed_updates?.posting_notes ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedReview.proposed_updates.posting_notes}
                  </p>
                ) : null}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-700">Evidence</h4>
                <div className="mt-2 space-y-2">
                  {selectedReview.evidence.length === 0 ? (
                    <p className="text-sm text-slate-500">No evidence attached.</p>
                  ) : (
                    selectedReview.evidence.map((item) => (
                      <a
                        key={item.url}
                        href={item.url}
                        className="block rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-slate-400"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {item.label}
                      </a>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-700">Actions</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedReview.recommended_actions.map((action) => (
                    <button
                      key={action.action_type}
                      type="button"
                      onClick={() => handleAction(action.action_type, action.payload)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleMark("pass")}
                    className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700"
                  >
                    Mark pass
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMark("needs_review")}
                    className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700"
                  >
                    Needs review
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMark("fail")}
                    className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700"
                  >
                    Mark fail
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a review to see details.</p>
          )}
        </section>
      </div>
    </div>
  );
}
