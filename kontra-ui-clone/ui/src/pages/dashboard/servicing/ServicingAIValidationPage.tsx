import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  useAiReview,
  useAiReviewsList,
  useApproveAiAction,
  useMarkAiReview,
} from '../../../features/ai-reviews/api';
import type { AiReviewStatus, AiReviewType } from '../../../features/ai-reviews/types';

const typeBadge = (type: AiReviewType) => {
  if (type === 'payment') return 'bg-indigo-100 text-indigo-700';
  if (type === 'inspection') return 'bg-sky-100 text-sky-700';
  if (type === 'compliance') return 'bg-violet-100 text-violet-700';
  return 'bg-slate-100 text-slate-700';
};

export default function ServicingAIValidationPage() {
  const navigate = useNavigate();
  const { reviewId } = useParams();
   const [search] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<AiReviewStatus>('needs_review');
  const [message, setMessage] = useState<string | null>(null);
  const selectedId = reviewId || search.get('review') || undefined;

   const listQuery = useAiReviewsList({ status: statusFilter });
  const selected = useAiReview(selectedId);
  const markMutation = useMarkAiReview();
  const approveMutation = useApproveAiAction();
   
  const reviews = listQuery.data?.items || [];
  const activeId = selectedId || reviews[0]?.id;

  useEffect(() => {
     if (!selectedId && reviews[0]?.id) {
      navigate(`/servicing/ai-validation/${reviews[0].id}`, { replace: true });
    }
   }, [selectedId, reviews, navigate]);
  
  const current = useMemo(() => {
    if (selected.data?.review) return selected.data.review;
    return reviews.find((item) => item.id === activeId);
  }, [selected.data?.review, reviews, activeId]);
  
  const onMark = async (status: AiReviewStatus) => {
    if (!current) return;
    await markMutation.mutateAsync({ id: current.id, status });
    setMessage(`Review marked as ${status.replace('_', ' ')}.`);
  };

 const onApproveAction = async (actionType: string, payload: unknown) => {
    if (!current) return;
    await approveMutation.mutateAsync({ id: current.id, action_type: actionType, action_payload: payload });
    setMessage('Action approval recorded.');
};
  
  return (
    <div className="space-y-6">
     <header>
        <h2 className="text-lg font-semibold text-slate-900">AI validation queue</h2>
      <p className="mt-1 text-sm text-slate-500">Unified decision queue for payment, inspection, and compliance reviews.</p>
      </header>

        {message ? <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{message}</div> : null}

      <div className="flex gap-2">
        {(['needs_review', 'pass', 'fail'] as AiReviewStatus[]).map((status) => (
          <button key={status} className={`rounded px-3 py-1 text-sm ${statusFilter === status ? 'bg-slate-900 text-white' : 'bg-white border'}`} onClick={() => setStatusFilter(status)}>
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

         <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-2">
          {listQuery.isLoading ? <p className="text-sm text-slate-500">Loading reviews…</p> : null}
          {!listQuery.isLoading && reviews.length === 0 ? <p className="rounded border bg-white p-3 text-sm text-slate-500">No AI reviews in this queue.</p> : null}
          {reviews.map((review) => (
            <button key={review.id} className={`w-full rounded border p-3 text-left ${current?.id === review.id ? 'border-slate-900' : 'border-slate-200 bg-white'}`} onClick={() => navigate(`/servicing/ai-validation/${review.id}`)}>
              <p className="font-medium">{review.title}</p>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${typeBadge(review.type)}`}>{review.type}</span>
                <span>{review.status.replace('_', ' ')}</span>
              </div>
            </button>
          ))}
           </div>
           
                 <div className="rounded border bg-white p-4">
          {!current ? (
            <p className="text-sm text-slate-500">Select a review.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">{current.title}</h3>
                <p className="text-sm text-slate-600">{current.summary}</p>
                <p className="text-xs text-slate-500">Confidence {(current.confidence * 100).toFixed(0)}%</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold">Reasons</h4>
                <ul className="mt-1 space-y-1 text-sm text-slate-600">
                  {current.reasons.map((reason) => <li key={reason.code}>{reason.message}</li>)}
                  {current.reasons.length === 0 ? <li>No exceptions detected.</li> : null}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold">Evidence</h4>
                <div className="mt-1 space-y-1">
                  {current.evidence.map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="block text-xs underline">{item.label}</a>)}
                  {current.evidence.length === 0 ? <p className="text-sm text-slate-500">No evidence links.</p> : null}
                </div>
                 </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Recommended actions</h4>
                <div className="flex flex-wrap gap-2">
                  {current.recommended_actions.map((action) => (
                    <button key={action.action_type} onClick={() => onApproveAction(action.action_type, action.payload)} className="rounded border px-2 py-1 text-xs">
                      Approve: {action.label}             
                     </button>
                   ))}
                </div>
                    </div>

              <div className="flex gap-2">
                <button className="rounded border border-emerald-300 px-2 py-1 text-xs" onClick={() => onMark('pass')}>Mark pass</button>
                <button className="rounded border border-amber-300 px-2 py-1 text-xs" onClick={() => onMark('needs_review')}>Needs review</button>
                <button className="rounded border border-rose-300 px-2 py-1 text-xs" onClick={() => onMark('fail')}>Mark fail</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
