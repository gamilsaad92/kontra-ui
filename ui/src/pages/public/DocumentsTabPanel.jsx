import { DEFAULT_PACK_ID } from '../../lib/workflowPacks';
import DocumentChecklistPanel from './DocumentChecklistPanel';
import VerificationPanel from './VerificationPanel';

/**
 * Documents tab — category-grouped checklist with inline AI findings,
 * plus cross-document verification checks at the bottom.
 *
 * The former Checklist / Intelligence sub-tabs have been consolidated:
 * AI findings are now surfaced inline per document row (expand to see
 * summary, key information, issues, and recommended next action).
 * The standalone Verification Log is now "Cross-document checks" at the
 * bottom, with a compact empty state until two or more docs are uploaded.
 */
export default function DocumentsTabPanel({
  propertyId,
  propertyType,
  role,
  isDemo,
  packId = DEFAULT_PACK_ID,
  packReady = true,
  onAnalysisSaved,
  refreshKey,
  jurisdiction,
  onPeople,
   requestTarget,
   onRequestTargetHandled,
}) {
  return (
    <div className="mb-6">
      <DocumentChecklistPanel
        propertyId={propertyId}
        propertyType={propertyType}
        role={role}
        isDemo={isDemo}
        packId={packId}
        packReady={packReady}
        onAnalysisSaved={onAnalysisSaved}
        refreshKey={refreshKey}
        jurisdiction={jurisdiction}
        onPeople={onPeople}
        requestTarget={requestTarget}
        onRequestTargetHandled={onRequestTargetHandled}
      />
      <VerificationPanel
        propertyId={propertyId}
        title="Cross-document checks"
        emptyStateMessage="Cross-document checks begin after two or more related documents are uploaded."
        defaultCollapsed={true}
      />
    </div>
  );
}
