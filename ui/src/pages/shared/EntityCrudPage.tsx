import { useMemo, useState, type ReactNode } from 'react';
import DataState from '../../components/DataState';
import type { CanonicalEntity } from '../../features/crud/types';

type HookSet = {
  useList: () => any;
  useCreate: () => any;
  useItem: (id?: string) => any;
  useUpdate: (id?: string) => any;
};

type Props = {
  title: string;
  createLabel: string;
  hooks: HookSet;
  renderRowActions?: (item: CanonicalEntity) => ReactNode;
};

function statusColor(status: string) {
  const s = (status || '').toLowerCase();
  if (s === 'active' || s === 'approved' || s === 'complete' || s === 'settled') return 'bg-emerald-100 text-emerald-700';
  if (s === 'pending' || s === 'in-review' || s === 'review') return 'bg-amber-100 text-amber-700';
  if (s === 'rejected' || s === 'failed' || s === 'overdue') return 'bg-brand-100 text-brand-700';
  if (s === 'draft' || s === 'inactive') return 'bg-slate-100 text-slate-600';
  return 'bg-slate-100 text-slate-600';
}

function formatDate(val: unknown): string {
  if (!val) return '';
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function DataField({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null;
  const displayVal = typeof value === 'object' ? null : String(value);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-sm text-slate-800 break-words">
        {displayVal ?? <span className="text-slate-400 italic">complex value</span>}
      </span>
    </div>
  );
}

export default function EntityCrudPage({ title, createLabel, hooks, renderRowActions }: Props) {
  const { data, isLoading, isError, refetch } = hooks.useList();
  const createMutation = hooks.useCreate();
  const items = (data?.items || []) as CanonicalEntity[];
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const activeId = selectedId || items[0]?.id;
  const detail = hooks.useItem(activeId);
  const updateMutation = hooks.useUpdate(activeId);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftStatus, setDraftStatus] = useState('active');
  const [editing, setEditing] = useState(false);

  const current = useMemo(() => detail.data as CanonicalEntity | undefined, [detail.data]);

  const syncDraft = () => {
    setDraftTitle((current?.name as string) || (current?.title as string) || '');
    setDraftStatus(current?.status || 'active');
    setEditing(true);
  };

  const dataEntries = useMemo(() => {
    if (!current?.data || typeof current.data !== 'object') return [];
    return Object.entries(current.data as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object')
      .slice(0, 12);
  }, [current]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{items.length} record{items.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating…' : `+ ${createLabel}`}
        </button>
      </div>

      {isError && (
        <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="text-sm text-brand-700">Failed to load {title.toLowerCase()}. Check your connection.</p>
          <button
            onClick={() => refetch()}
            className="rounded border border-brand-300 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            Retry
          </button>
        </div>
      )}

      <DataState
        isLoading={isLoading}
        isError={false}
        error={null}
        isEmpty={!isLoading && !isError && items.length === 0}
        emptyTitle={`No ${title.toLowerCase()} found`}
        emptyActionLabel={createLabel}
        onEmptyAction={() => createMutation.mutate()}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-2">
            {items.map((item) => {
              const isActive = item.id === activeId;
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 cursor-pointer transition ${
                    isActive
                      ? 'border-slate-900 bg-white shadow-sm ring-1 ring-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                  }`}
                  onClick={() => { setSelectedId(item.id); setEditing(false); }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {item.name || item.title || <span className="text-slate-400">Untitled</span>}
                    </p>
                    {item.status && (
                      <span className={`flex-none rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor(item.status)}`}>
                        {item.status}
                      </span>
                    )}
                  </div>
                  {item.created_at && (
                    <p className="mt-1 text-xs text-slate-400">{formatDate(item.created_at)}</p>
                  )}
                  {renderRowActions && (
                    <div className="mt-2 border-t border-slate-100 pt-2" onClick={(e) => e.stopPropagation()}>
                      {renderRowActions(item)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            {!activeId ? (
              <div className="flex items-center justify-center h-full py-16 text-sm text-slate-400">
                Select a record to view details
              </div>
            ) : detail.isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              </div>
            ) : detail.isError ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <p className="text-sm text-brand-600">Failed to load record.</p>
                <button
                  className="rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => detail.refetch()}
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {current?.name || current?.title || 'Record detail'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">ID: {current?.id}</p>
                  </div>
                  {!editing && (
                    <button
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                      onClick={syncDraft}
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editing ? (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {current?.name !== undefined ? 'Name' : 'Title'}
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        placeholder={current?.name !== undefined ? 'Record name' : 'Title'}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</label>
                      <select
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                        value={draftStatus}
                        onChange={(e) => setDraftStatus(e.target.value)}
                      >
                        <option value="active">Active</option>
                        <option value="pending">Pending</option>
                        <option value="draft">Draft</option>
                        <option value="in-review">In Review</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition"
                        onClick={() =>
                          updateMutation.mutate(
                            current?.name !== undefined
                              ? { name: draftTitle, status: draftStatus }
                              : { title: draftTitle, status: draftStatus },
                            { onSuccess: () => setEditing(false) }
                          )
                        }
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? 'Saving…' : 'Save changes'}
                      </button>
                      <button
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                        onClick={() => setEditing(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {current?.status && (
                        <DataField label="Status" value={current.status} />
                      )}
                      {current?.created_at && (
                        <DataField label="Created" value={formatDate(current.created_at)} />
                      )}
                      {current?.updated_at && (
                        <DataField label="Last updated" value={formatDate(current.updated_at)} />
                      )}
                    </div>
                    {dataEntries.length > 0 && (
                      <div className="border-t border-slate-100 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Record data</p>
                        <div className="grid grid-cols-2 gap-3">
                          {dataEntries.map(([key, val]) => (
                            <DataField key={key} label={key.replace(/_/g, ' ')} value={formatValue(val)} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DataState>
    </div>
  );
}
