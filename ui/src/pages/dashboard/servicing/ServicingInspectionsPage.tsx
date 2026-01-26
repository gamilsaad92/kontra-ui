import { useEffect, useMemo, useState } from "react";
import type { AiReview, AiReviewStatus } from "../../../features/ai-reviews/types";
import {
  approveAction,
  getReviews,
  markReview,
  reviewInspection,
} from "../../../features/ai-reviews/api";

export default function ServicingInspectionsPage() {
  const [statusFilter, setStatusFilter] = useState<AiReviewStatus | "all">("all");
  const [reviews, setReviews] = useState<AiReview[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [inspectionId, setInspectionId] = useState("");
  const [loading, setLoading] = useState(false);

  const mockReviews: AiReview[] = [
    {
      id: "mock-inspection-1",
      org_id: "org-1",
      project_id: "project-9",
      loan_id: "loan-204",
      type: "inspection",
      source_id: "inspection-332",
      status: "needs_review",
      confidence: 0.51,
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
        {
          action_type: "order_reinspection",
          label: "Order reinspection",
          payload: { reason: "Insufficient evidence for scope completion." },
          requires_approval: true,
        },
      ],
      proposed_updates: {
        photo_checklist: {
          required: ["wide_shot", "unit_id", "before_after"],
          available: ["unit_id"],
          missing: ["wide_shot", "before_after"],
        },
        scope_to_evidence: [
          {
            lineItemId: "sov-12",
            claimedPct: 65,
            supportedPct: 40,
            reason: "Evidence set includes photos that partially support completion.",
          },
        ],
      },
      created_by: "ai",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const filteredReviews = useMemo(() => {
    if (statusFilter === "all") return reviews;
    return reviews.filter((review) => review.status === statusFilter);
  }, [reviews, statusFilter]);

  const selectedReview = useMemo(
    () => filteredReviews.find((review) => review.id === selectedId) ?? filteredReviews[0],
    [filteredReviews, selectedId]
  );

  useEffect(() => {
    setSelectedId(selectedReview?.id ?? null);
  }, [selectedReview?.id]);

  const loadReviews = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const data = await getReviews({
        type: "inspection",
        status: statusFilter === "all" ? undefined : statusFilter,
      });
      setReviews(data.length ? data : mockReviews);
    } catch (error) {
      setReviews(mockReviews);
      setMessage("Live inspection reviews unavailable. Showing mock queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, [statusFilter]);

  const handleRunReview = async () => {
    if (!inspectionId) {
      setMessage("Enter an inspection ID to run AI review.");
      return;
    }
    setMessage(null);
    try {
      const review = await reviewInspection(inspectionId);
      setReviews((prev) => [review, ...prev]);
      setSelectedId(review.id);
      setInspectionId("");
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

  const checklist = selectedReview?.proposed_updates?.photo_checklist;
  const scopeEvidence = selectedReview?.proposed_updates?.scope_to_evidence ?? [];

  return (
    <div className="space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">AI Inspection Review</h2>
          <p className="text-sm text-slate-500">
            Validate inspection evidence, match scope to photos, and approve next-step actions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Inspection ID"
            value={inspectionId}
            onChange={(event) => setInspectionId(event.target.value)}
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
              Inspection review queue
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
                  <p className="text-xs opacity-70">Project {review.project_id ?? "—"}</p>
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
                <h4 className="text-sm font-semibold text-slate-700">Photo checklist</h4>
                <div className="mt-2 grid gap-2 text-sm text-slate-600">
                  <div>
                    <span className="font-semibold text-slate-500">Required:</span>{" "}
                    {checklist?.required?.join(", ") || "—"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Available:</span>{" "}
                    {checklist?.available?.join(", ") || "—"}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Missing:</span>{" "}
                    {checklist?.missing?.join(", ") || "None"}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-700">Scope matching</h4>
                <div className="mt-2 space-y-2 text-sm text-slate-600">
                  {scopeEvidence.length === 0 ? (
                    <p>No scope items linked.</p>
                  ) : (
                    scopeEvidence.map((item: any) => (
                      <div key={item.lineItemId} className="rounded-lg border border-slate-200 px-3 py-2">
                        <p className="font-semibold text-slate-700">
                          Line item {item.lineItemId}
                        </p>
                        <p className="text-xs text-slate-500">
                          Claimed {item.claimedPct}% • Supported {item.supportedPct}%
                        </p>
                        <p className="text-xs text-slate-500">{item.reason}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-700">Evidence gallery</h4>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {selectedReview.evidence.length === 0 ? (
                    <p className="text-sm text-slate-500">No evidence attached.</p>
                  ) : (
                    selectedReview.evidence.map((item) => (
                      <a
                        key={item.url}
                        href={item.url}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-slate-400"
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
