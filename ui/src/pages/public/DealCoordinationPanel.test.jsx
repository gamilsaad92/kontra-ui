import {
  getChecklistItemsForRole,
  getEffectiveChecklistItems,
} from './DealCoordinationPanel';

describe('saved checklist assignments in coordination progress', () => {
  const schema = [
    { id: 'loi', section: 'loi', label: 'Letter of Intent', assignedTo: ['buyer'] },
    { id: 'financials', section: 'financials', label: 'Financials', assignedTo: ['seller'] },
  ];

  test('keeps custom rows and uses their persisted assignment', () => {
    const saved = [
      { id: 'loi', section: 'loi', label: 'LOI', assignedTo: ['counsel'] },
      { id: 'custom_vendor', section: 'custom_vendor', label: 'Vendor Schedule', assignedTo: ['Seller'] },
    ];

    expect(getChecklistItemsForRole(saved, 'seller', schema).map(item => item.section))
      .toEqual(['custom_vendor']);
    expect(getChecklistItemsForRole(saved, 'buyer', schema)).toEqual([]);
  });

  test('falls back to template assignment for legacy rows without assignedTo', () => {
    const saved = [{ id: 'loi', section: 'loi', label: 'LOI', assignedTo: [] }];

    expect(getEffectiveChecklistItems(saved, schema)[0].assignedTo).toEqual(['buyer']);
    expect(getChecklistItemsForRole(saved, 'buyer', schema).map(item => item.section))
      .toEqual(['loi']);
  });
});