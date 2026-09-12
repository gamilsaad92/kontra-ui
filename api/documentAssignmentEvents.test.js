const {
  normalizeAssignmentRole,
  getNewlyAssignedChecklistEntries,
} = require('./lib/documentAssignmentEvents');

describe('document assignment event diffs', () => {
  it('detects a newly assigned custom document without depending on a workflow pack', () => {
    expect(getNewlyAssignedChecklistEntries(
      [{ section: 'custom_questionnaire', label: 'Questionnaire', assignedTo: [] }],
      [{ section: 'custom_questionnaire', label: 'Questionnaire', assignedTo: ['buyer'], required: true }],
    )).toEqual([{
      id: 'custom_questionnaire',
      section: 'custom_questionnaire',
      label: 'Questionnaire',
      required: true,
      newlyAssignedRoles: ['buyer'],
    }]);
  });

  it('does not emit again when a save preserves the same assignment', () => {
    expect(getNewlyAssignedChecklistEntries(
      [{ section: 'custom_questionnaire', assignedTo: ['Buyer'] }],
      [{ section: 'custom_questionnaire', assignedTo: [' buyer '] }],
    )).toEqual([]);
  });

  it('notifies only the new role during reassignment', () => {
    expect(getNewlyAssignedChecklistEntries(
      [{ section: 'custom_questionnaire', assignedTo: ['buyer'] }],
      [{ section: 'custom_questionnaire', assignedTo: ['seller'] }],
    )[0].newlyAssignedRoles).toEqual(['seller']);
  });

  it('supports multiple generic workflow roles and preserves normalized keys', () => {
    expect(normalizeAssignmentRole('Lead Investor')).toBe('lead_investor');
    expect(getNewlyAssignedChecklistEntries(
      [],
      [
        { id: 'kyc', label: 'KYC', assignedTo: ['lead_investor', 'Counsel'] },
        { id: 'audit', label: 'Audit', assignedTo: ['auditor'] },
      ],
    ).map(item => item.newlyAssignedRoles)).toEqual([
      ['lead_investor', 'counsel'],
      ['auditor'],
    ]);
  });

  it('does not treat the first canonical checklist seed as new participant work', () => {
    expect(getNewlyAssignedChecklistEntries(
      [],
      [{ section: 'purchase_agreement', assignedTo: ['buyer'], isCustom: false }],
      { onlyExplicitCustomOnEmptyBaseline: true },
    )).toEqual([]);
  });

  it('does notify when a new explicit custom document is assigned on that first save', () => {
    expect(getNewlyAssignedChecklistEntries(
      [],
      [{ section: 'custom_nda', label: 'Custom NDA', assignedTo: ['buyer'], isCustom: true }],
      { onlyExplicitCustomOnEmptyBaseline: true },
    )).toEqual([{
      id: 'custom_nda',
      section: 'custom_nda',
      label: 'Custom NDA',
      required: false,
      newlyAssignedRoles: ['buyer'],
    }]);
  });
});