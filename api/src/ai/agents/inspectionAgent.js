function runInspectionAgent(inspectionData = {}) {
  const photos = Array.isArray(inspectionData.photos) ? inspectionData.photos : [];
  const requiredPhotosCount = Number(inspectionData.required_photos_count || 6);
  const scopeItems = Array.isArray(inspectionData.scope_items) ? inspectionData.scope_items : [];

  const reasons = [];
  const evidence = photos
    .filter((url) => typeof url === 'string' && url.startsWith('http'))
    .map((url, index) => ({
      label: `Inspection photo ${index + 1}`,
      url,
      kind: 'image',
    }));

  if (photos.length < requiredPhotosCount) {
    reasons.push({
      code: 'MISSING_PHOTOS',
      message: `Only ${photos.length} photo(s) provided; ${requiredPhotosCount} required.`,
      severity: 'high',
    });
  }

  let mismatchCount = 0;
  for (const item of scopeItems) {
    const claimedPct = Number(item.claimedPct ?? 0);
    const supportedPct = Number(item.supportedPct ?? (photos.length > 0 ? Math.min(claimedPct, 100) : 0));
    if (Math.abs(claimedPct - supportedPct) > 15) mismatchCount += 1;
  }

  if (mismatchCount > 0) {
    reasons.push({
      code: 'SCOPE_MISMATCH',
      message: `${mismatchCount} scope item(s) have claimed vs supported progress mismatch.`,
      severity: 'med',
    });
  }

  const status = reasons.length > 0 ? 'needs_review' : 'pass';

  return {
    status,
    confidence: status === 'pass' ? 0.88 : 0.58,
    title: status === 'pass' ? 'Inspection passed AI review' : 'Inspection requires AI exception review',
    summary:
      status === 'pass'
        ? 'Inspection evidence appears complete for milestone decisioning.'
        : 'Inspection evidence has issues requiring human review.',
    reasons,
    evidence,
    recommended_actions:
      status === 'pass'
        ? [
            {
              action_type: 'approve_milestone',
              label: 'Approve milestone',
              payload: { result: 'pass' },
              requires_approval: true,
            },
          ]
        : [
            {
              action_type: 'request_missing_photos',
              label: 'Request missing photos',
              payload: { required_photos_count: requiredPhotosCount, provided: photos.length },
              requires_approval: true,
            },
            {
              action_type: 'order_reinspection',
              label: 'Order reinspection',
              payload: { reason: 'AI detected evidence mismatch.' },
              requires_approval: true,
            },
          ],
    proposed_updates: { required_photos_count: requiredPhotosCount, photos_count: photos.length },
  };
}

module.exports = { runInspectionAgent };
