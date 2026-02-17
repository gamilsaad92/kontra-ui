import { useMemo, useState } from 'react';
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
};

export default function EntityCrudPage({ title, createLabel, hooks }: Props) {
  const { data, isLoading, isError, refetch } = hooks.useList();
  const createMutation = hooks.useCreate();
  const items = (data?.items || []) as CanonicalEntity[];
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const activeId = selectedId || items[0]?.id;
  const detail = hooks.useItem(activeId);
  const updateMutation = hooks.useUpdate(activeId);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftStatus, setDraftStatus] = useState('active');

  const current = useMemo(() => detail.data as CanonicalEntity | undefined, [detail.data]);

  const syncDraft = () => {
    setDraftTitle((current?.title as string) || '');
    setDraftStatus(current?.status || 'active');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button className="rounded bg-slate-900 px-3 py-2 text-white" onClick={() => createMutation.mutate()}>
          {createLabel}
        </button>
      </div>
      <DataState
        isLoading={isLoading}
        isError={isError}
        error={isError ? 'Failed to load records' : null}
        isEmpty={!isLoading && items.length === 0}
        emptyTitle={`No ${title.toLowerCase()} yet.`}
        emptyActionLabel={createLabel}
        onEmptyAction={() => createMutation.mutate()}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded border bg-white p-3">
            {items.map((item) => (
              <button key={item.id} className="block w-full rounded border p-2 text-left" onClick={() => setSelectedId(item.id)}>
                <div className="font-medium">{item.title || item.id}</div>
                <div className="text-xs text-slate-500">{item.status}</div>
              </button>
            ))}
          </div>
          <div className="rounded border bg-white p-3">
            {activeId ? (
              detail.isLoading ? (
                <p>Loading detail...</p>
              ) : detail.isError ? (
                <div>
                  <p className="text-sm text-red-600">Error loading detail.</p>
                  <button className="mt-2 rounded border px-3 py-1" onClick={() => detail.refetch()}>Retry</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button className="rounded border px-2 py-1 text-xs" onClick={syncDraft}>Load into editor</button>
                  <input className="w-full rounded border p-2" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Title" />
                  <input className="w-full rounded border p-2" value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)} placeholder="Status" />
                  <button
                    className="rounded bg-slate-900 px-3 py-2 text-white"
                    onClick={() => updateMutation.mutate({ title: draftTitle, status: draftStatus })}
                  >
                    Save
                  </button>
                  <pre className="max-h-64 overflow-auto rounded bg-slate-100 p-2 text-xs">{JSON.stringify(current?.data || {}, null, 2)}</pre>
                </div>
              )
            ) : (
              <p>Select a record.</p>
            )}
          </div>
        </div>
      </DataState>
      <button className="text-xs underline" onClick={() => refetch()}>Retry list</button>
    </div>
  );
}
