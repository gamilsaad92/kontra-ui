import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { AiReview, AiReviewStatus } from "../../../features/ai-reviews/types";
import { approveAction, getReviews, markReview } from "../../../features/ai-reviews/api";

export default function ServicingAIValidationPage() {
const navigate = useNavigate();
  const { reviewId } = useParams();
  const [statusFilter, setStatusFilter] = useState<AiReviewStatus>("needs_review");
  const [reviews, setReviews] = useState<AiReview[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(reviewId ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const mockReviews: AiReview[] = [
    {
      id: "mock-validation-payment",
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
      ],
      proposed_updates: {},
      created_by: "ai",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "mock-validation-inspection",
      org_id: "org-1",
      project_id: "project-11",
      loan_id: "loan-321",
      type: "inspection",
      source_id: "inspection-33",
      status: "needs_review",
      confidence: 0.53,
      title: "Inspection needs review: missing required photos",
      summary: "Inspection evidence requires human review before any servicing action.",
      reasons: [
        {
          code: "missing_required_photos",
          message: "Missing photo types: wide_shot, before_after.",
          severity: "medium",
        },
      ],
      evidence: [
        {
          label: "Unit interior",
          url: "https://example.com/inspection-332-1.jpg",
          kind: "photo",
        },
      ],
      recommended_actions: [
        {
          action_type: "request_missing_photos",
          label: "Request missing inspection photos",
          payload: { missing: ["wide_shot", "before_after"] },
          requires_approval: true,
        },
      ],
      proposed_updates: {},
      created_by: "ai",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => review.status === statusFilter);
  }, [reviews, statusFilter]);

  const selectedReview = useMemo(
    () => filteredReviews.find((review) => review.id === selectedId) ?? filteredReviews[0],
    [filteredReviews, selectedId]
  );

  useEffect(() => {
    if (reviewId) {
      setSelectedId(reviewId);
    }
  }, [reviewId]);

  useEffect(() => {
    setSelectedId(selectedReview?.id ?? null);
  }, [selectedReview?.id]);

  const loadReviews = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await getReviews({ status: statusFilter });
      setReviews(data.length ? data : mockReviews);
    } catch (error) {
      setReviews(mockReviews);
      setMessage("Live AI validation queue unavailable. Showing mock data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [statusFilter]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    navigate(`/servicing/ai-validation/${id}`);
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

    const typeBadgeClass = (type: string) =>
    type === "payment"
      ? "bg-indigo-100 text-indigo-700"
      : "bg-sky-100 text-sky-700";

  return (
    <div className="space-y-6">
     <header>
        <h2 className="text-lg font-semibold text-slate-900">AI validation queue</h2>
        <p className="mt-1 text-sm text-slate-500">
            Unified queue for AI validation outcomes across payments and inspections. Human approval
          is required before any external action.
        </p>
      </header>

      {message ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-2">
          {["needs_review", "pass", "fail"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status as AiReviewStatus)}
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
                  : "Fail"}
            </button>
          ))}
          <p className="text-xs text-slate-500">
            {loading ? "Refreshing…" : `${filteredReviews.length} items`}
          </p>
        </aside>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="space-y-3">
            {filteredReviews.map((review) => (
              <button
                key={review.id}
                type="button"
                onClick={() => handleSelect(review.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left shadow-sm transition ${
                  selectedReview?.id === review.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-900 hover:border-slate-400"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{review.title}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs opacity-70">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${typeBadgeClass(review.type)}`}>
                        {review.type}
                      </span>
                      <span>{review.loan_id ?? review.project_id ?? "—"}</span>
                    </div>
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
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
          </div>
        </section>
      </div>
    </div>
  );
}
