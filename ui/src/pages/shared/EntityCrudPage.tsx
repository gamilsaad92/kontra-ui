import { useMemo, useState, type ReactNode } from 'react';
import DataState from '../../components/DataState';
import type { CanonicalEntity } from '../../features/crud/types';
import { useOrg } from '../../lib/OrgProvider';

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
    requireOrg?: boolean;
};

function formatErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  const record = error as { message?: string; error?: string; details?: unknown };
  return record.message || record.error || fallback;
}

export default function EntityCrudPage({ title, createLabel, hooks, renderRowActions, requireOrg = false }: Props) {
  const { data, isLoading, isError, error, refetch } = hooks.useList();
  const createMutation = hooks.useCreate();
  const items = (data?.items || []) as CanonicalEntity[];
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
 const { authReady, activeOrganizationId, loading: orgLoading, error: orgError } = useOrg();
  const orgBlocked = requireOrg && (!authReady || !activeOrganizationId);
  const activeId = orgBlocked ? undefined : selectedId || items[0]?.id;
  const detail = hooks.useItem(activeId);
  const updateMutation = hooks.useUpdate(activeId);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftStatus, setDraftStatus] = useState('active');

  const current = useMemo(() => detail.data as CanonicalEntity | undefined, [detail.data]);
 const listError = orgBlocked
    ? orgError || 'Organization context is still loading. Please wait a moment and retry.'
    : formatErrorMessage(error, `Unable to load ${title.toLowerCase()}. Please retry.`);
  
  const syncDraft = () => {
    setDraftTitle((current?.name as string) || (current?.title as string) || '');
    setDraftStatus(current?.status || 'active');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button
          className="rounded bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => createMutation.mutate()}
          disabled={orgBlocked || createMutation.isPending}
          title={orgBlocked ? 'Organization context is required before creating records.' : createLabel}
        >
        {createLabel}
        </button>
      </div>
           {orgBlocked && requireOrg ? (
        <div className="rounded border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          {orgLoading ? 'Loading organization context…' : listError}
        </div>
      ) : null}
      <DataState
           isLoading={orgBlocked ? true : isLoading}
        isError={!orgBlocked && isError}
        error={!orgBlocked && isError ? `${listError} Use Retry to try again.` : null}
        isEmpty={!orgBlocked && !isLoading && items.length === 0}
        emptyTitle={`No ${title.toLowerCase()} yet.`}
        emptyActionLabel={createLabel}
        onEmptyAction={() => createMutation.mutate()}
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded border bg-white p-3">
            {items.map((item) => (
              <div key={item.id} className="rounded border p-2">
                <button className="block w-full text-left" onClick={() => setSelectedId(item.id)}>
                  <div className="font-medium">{item.name || item.title || item.id}</div>
                  <div className="text-xs text-slate-500">{item.status}</div>
                </button>
                {renderRowActions ? <div className="mt-2">{renderRowActions(item)}</div> : null}
              </div>
            ))}
          </div>
          <div className="rounded border bg-white p-3">
            {activeId ? (
              detail.isLoading ? (
                <p>Loading detail...</p>
              ) : detail.isError ? (
                <div>
                  <p className="text-sm text-red-600">{formatErrorMessage(detail.error, 'Error loading detail.')}</p>
                  <button className="mt-2 rounded border px-3 py-1" onClick={() => detail.refetch()}>Retry</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button className="rounded border px-2 py-1 text-xs" onClick={syncDraft}>Load into editor</button>
                <input className="w-full rounded border p-2" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder={current?.name !== undefined ? 'Organization name' : 'Title'} />  
                  <input className="w-full rounded border p-2" value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)} placeholder="Status" />
                  <button
                    className="rounded bg-slate-900 px-3 py-2 text-white"
                    onClick={() =>
                      updateMutation.mutate(
                        current?.name !== undefined
                          ? { name: draftTitle, status: draftStatus }
                          : { title: draftTitle, status: draftStatus },
                      )
                    }
                  >
                    Save
                  </button>
                  <pre className="max-h-64 overflow-auto rounded bg-slate-100 p-2 text-xs">{JSON.stringify(current?.data || {}, null, 2)}</pre>
                </div>
              )
            ) : (
   <p>{orgBlocked ? 'Waiting for organization context.' : 'Select a record.'}</p>
            )}
          </div>
        </div>
      </DataState>
      <button className="text-xs underline disabled:opacity-50" onClick={() => refetch()} disabled={orgBlocked}>Retry list</button>
    </div>
  );
}
