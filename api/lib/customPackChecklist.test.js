'use strict';

const { projectDocumentChecklist } = require('./documentStatus');
const { resolveRoomChecklist } = require('./customPackChecklist');

const REDWOOD_PACK_ID = 'ws_redwood_business_center_acquis_mwk1m4zr';
const REDWOOD_DOCUMENTS = [
  { id: 'letter_of_intent', label: 'Letter of Intent', required: true, assignedTo: ['buyer'] },
  {
    id: 'property_inspection_report',
    label: 'Property Inspection Report',
    required: true,
    ai: true,
    aiExtraction: { docTypes: ['Property Inspection Report', 'Phase I Inspection'] },
    assignedTo: ['buyer'],
  },
  { id: 'title_report', label: 'Title Report', required: true, ai: true, assignedTo: ['buyer'] },
  { id: 'financing_documents', label: 'Financing Documents', required: true, ai: true, assignedTo: ['buyer'] },
  { id: 'closing_documents', label: 'Closing Documents', required: true, assignedTo: ['buyer'] },
  { id: 'financial_statements', label: 'Financial Statements', required: true, ai: true, assignedTo: ['financial_advisor'] },
].map(document => ({
  ...document,
  section: document.id,
}));

function customPackDatabase(documents) {
  const calls = [];
  const supabase = {
    from(table) {
      calls.push(['from', table]);
      return {
        select(columns) {
          calls.push(['select', columns]);
          return this;
        },
        eq(column, value) {
          calls.push(['eq', column, value]);
          return this;
        },
        async maybeSingle() {
          calls.push(['maybeSingle']);
          return { data: { config: { documents } }, error: null };
        },
      };
    },
  };
  return { supabase, calls };
}

describe('custom workflow pack checklist fallback', () => {
  test('projects all six missing Redwood documents when the saved checklist is null', async () => {
    const { supabase, calls } = customPackDatabase(REDWOOD_DOCUMENTS);
    const checklist = await resolveRoomChecklist({
      workflow_pack_id: REDWOOD_PACK_ID,
      checklist_items: null,
    }, supabase);
    const projection = projectDocumentChecklist(checklist, []);

    expect(projection.missingDocuments.map(document => document.label)).toEqual([
      'Letter of Intent',
      'Property Inspection Report',
      'Title Report',
      'Financing Documents',
      'Closing Documents',
      'Financial Statements',
    ]);
    expect(checklist[1].aiExtraction.docTypes).toEqual([
      'Property Inspection Report',
      'Phase I Inspection',
    ]);
    expect(calls).toEqual([
      ['from', 'custom_workflow_packs'],
      ['select', 'config'],
      ['eq', 'id', REDWOOD_PACK_ID],
      ['maybeSingle'],
    ]);
  });

  test('keeps a nonempty saved checklist authoritative but does not trust its received status without evidence', async () => {
    const savedChecklist = [{
      id: 'saved-requirement',
      section: 'saved-requirement',
      label: 'Saved Room Requirement',
      required: true,
      status: 'received',
    }];
    const { supabase, calls } = customPackDatabase(REDWOOD_DOCUMENTS);
    const checklist = await resolveRoomChecklist({
      workflow_pack_id: REDWOOD_PACK_ID,
      checklist_items: savedChecklist,
    }, supabase);
    const projection = projectDocumentChecklist(checklist, []);

    expect(checklist).toBe(savedChecklist);
    expect(projection.items).toHaveLength(1);
    expect(projection.items[0]).toMatchObject({
      id: 'saved-requirement',
      label: 'Saved Room Requirement',
      documentState: 'missing',
      documentReceived: false,
    });
    expect(projection.missingDocuments).toEqual([
      expect.objectContaining({ label: 'Saved Room Requirement' }),
    ]);
    expect(calls).toEqual([]);
  });
});
