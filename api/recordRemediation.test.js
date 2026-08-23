const {
  buildRecordRemediationTask,
  getRecordRemediationPlan,
} = require('./lib/recordRemediation');

describe('universal record remediation planning', () => {
  const field = {
    key: 'financial.insurance_proceeds_control',
    label: 'Insurance Proceeds Control',
    status: 'missing',
  };

  test('creates an idempotent coordinator remediation from any generated required field', () => {
    const task = buildRecordRemediationTask(field);
    const plan = getRecordRemediationPlan({ requiredFields: [field] });

    expect(task).toEqual(expect.objectContaining({
      taskType: 'missing_required_record_field',
      title: 'Provide Insurance Proceeds Control',
      sourceType: 'transaction_record',
      sourceId: 'transaction-record-required:financial.insurance_proceeds_control:schema',
      ownerType: 'human',
    }));
    expect(plan.upsert).toEqual([{ task, existing: null }]);
  });

  test('moves a missing remediation to dismissed when new evidence is awaiting confirmation', () => {
    const existing = {
      id: 'remediation-1',
      task_type: 'missing_required_record_field',
      source_id: 'transaction-record-required:financial.insurance_proceeds_control:cleared-at-1',
      status: 'pending',
    };

    const plan = getRecordRemediationPlan({
      requiredFields: [{
        ...field,
        status: 'awaiting',
        value: '$325,000',
        updatedAt: 'evidence-at-2',
      }],
    }, [existing]);

    expect(plan.upsert).toEqual([]);
    expect(plan.dismiss).toEqual([existing]);
  });

  test('uses a new state version when a missing field is cleared again later', () => {
    const oldRemediation = {
      id: 'remediation-1',
      task_type: 'missing_required_record_field',
      source_id: 'transaction-record-required:financial.insurance_proceeds_control:cleared-at-1',
      status: 'pending',
    };

    const plan = getRecordRemediationPlan({
      requiredFields: [{
        ...field,
        updatedAt: 'cleared-at-2',
      }],
    }, [oldRemediation]);

    expect(plan.upsert[0].task.sourceId)
      .toBe('transaction-record-required:financial.insurance_proceeds_control:cleared-at-2');
    expect(plan.dismiss).toEqual([oldRemediation]);
  });

  test('does not create a confirmation/remediation task for a confirmed value', () => {
    const existing = {
      id: 'remediation-1',
      task_type: 'missing_required_record_field',
      source_id: 'transaction-record-required:financial.insurance_proceeds_control:schema',
      status: 'pending',
    };

    const plan = getRecordRemediationPlan({
      requiredFields: [{
        ...field,
        status: 'confirmed',
        value: '$325,000',
      }],
    }, [existing]);

    expect(plan.upsert).toEqual([]);
    expect(plan.dismiss).toEqual([existing]);
  });
});