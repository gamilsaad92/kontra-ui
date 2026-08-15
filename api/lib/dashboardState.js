const ACTIVE_INVITE_STATUSES = new Set(['accepted', 'active']);

function isActiveInvite(invite, now = Date.now()) {
  if (!invite || !ACTIVE_INVITE_STATUSES.has(String(invite.status || '').toLowerCase())) {
    return false;
  }
  if (invite.revoked_at) return false;
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= now) return false;
  return true;
}

function assignedRoles(document) {
  const assignedTo = Array.isArray(document?.assignedTo)
    ? document.assignedTo
    : document?.assignedRole
      ? [document.assignedRole]
      : [];
  return assignedTo
    .map(role => String(role || '').trim().toLowerCase().replace(/\s+/g, '_'))
    .filter(Boolean);
}

function documentSection(document) {
  return String(document?.section || document?.id || '').trim();
}

function buildRoomParticipants({ invites = [], submissions = [], now = Date.now() } = {}) {
  const activeRoles = new Set();
  const participants = [];

  for (const invite of invites) {
    const role = String(invite?.role_key || invite?.role || '').trim();
    if (!role || !isActiveInvite(invite, now)) continue;
    const normalizedRole = role.toLowerCase().replace(/\s+/g, '_');
    if (activeRoles.has(normalizedRole)) continue;
    activeRoles.add(normalizedRole);
    participants.push({
      role,
      status: 'accepted',
      source: 'invite',
      last_used_at: invite.last_used_at || null,
    });
  }

  // Legacy rooms may have a submission but no invite row. Keep that durable
  // activity visible, while never allowing an old submission to duplicate an
  // accepted invite for the same role.
  for (const submission of submissions) {
    const role = String(submission?.role || '').trim();
    if (!role) continue;
    const normalizedRole = role.toLowerCase().replace(/\s+/g, '_');
    if (activeRoles.has(normalizedRole)) continue;
    if (!submission.doc_count && !submission.submitted_at) continue;
    activeRoles.add(normalizedRole);
    participants.push({
      ...submission,
      role,
      status: 'submitted',
      source: 'submission',
    });
  }

  return participants;
}

function computeRoomDashboardState({
  room = {},
  analyses = [],
  invites = [],
  submissions = [],
  documents = [],
  now = Date.now(),
} = {}) {
  const uploadedSections = new Set(
    analyses
      .filter(analysis => analysis?.section !== 'cross_document_verification')
      .map(analysis => String(analysis?.section || '').trim())
      .filter(Boolean),
  );
  const requiredDocuments = documents.filter(document => document?.required);
  const unresolvedRoles = new Set();
  const aiSections = new Set(
    documents
      .filter(document => document?.ai)
      .map(documentSection)
      .filter(Boolean),
  );

  for (const document of requiredDocuments) {
    const section = documentSection(document);
    if (!section || uploadedSections.has(section)) continue;
    assignedRoles(document).forEach(role => unresolvedRoles.add(role));
  }

  const participants = buildRoomParticipants({ invites, submissions, now });
  const processedAnalyses = analyses.filter(analysis => !analysis?.analysis?.pending);

  return {
    property_id: room.property_id || null,
    activeParticipants: participants.length,
    participants,
    // Verification rows are generated summaries, not uploaded documents.
    documentCount: analyses.filter(analysis => analysis?.section !== 'cross_document_verification').length,
    aiReviewsCompleted: processedAnalyses.filter(analysis => {
      const section = String(analysis?.section || '').trim();
      return aiSections.has(section)
        || (!documents.length && ['inspection', 'insurance', 'financials', 'legal', 'brand-standards'].includes(section));
    }).length,
    waitingOnBorrower: unresolvedRoles.has('owner') || unresolvedRoles.has('borrower'),
    waitingOnInspector: unresolvedRoles.has('inspector'),
  };
}

module.exports = {
  ACTIVE_INVITE_STATUSES,
  isActiveInvite,
  buildRoomParticipants,
  computeRoomDashboardState,
};