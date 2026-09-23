'use strict';

const {
  TRANSACTION_ENTRY_MODES,
  historicalLifecycleStage,
} = require('./transactionEntryMode');

function inferGeneratedCurrentStage(stages = [], proposal = null) {
  const safeStages = Array.isArray(stages) ? stages : [];
  if (safeStages.length === 0) return null;
  const transaction = proposal?.transaction || {};
  const facts = Array.isArray(proposal?.transaction_record_fields)
    ? proposal.transaction_record_fields
    : [];
  const contextFacts = Array.isArray(transaction.context_facts) ? transaction.context_facts : [];
  const text = [
    transaction.description,
    ...contextFacts.flatMap(fact => [fact?.label, fact?.value]),
    ...facts.flatMap(field => [field?.label, field?.value]),
  ].filter(Boolean).join(' ').toLowerCase();
  const loiExecuted = /\b(?:loi|letter of intent)\b[\s\S]{0,80}\b(?:signed|executed|fully executed)\b|\b(?:signed|executed|fully executed)\b[\s\S]{0,80}\b(?:loi|letter of intent)\b/.test(text);
  const diligenceStarted = /\b(?:due diligence|diligence)\b[\s\S]{0,60}\b(?:beginning|begun|starting|started|underway|in progress)\b|\b(?:beginning|begun|starting|started|underway|in progress)\b[\s\S]{0,60}\b(?:due diligence|diligence)\b/.test(text);
  const findStage = pattern => safeStages.find(stage => pattern.test(`${stage.key || ''} ${stage.label || ''}`.toLowerCase()));
  if (loiExecuted && diligenceStarted) {
    return findStage(/\b(due diligence|diligence|underwriting|review|verification)\b/)?.key
      || safeStages[Math.min(2, safeStages.length - 1)].key;
  }
  if (loiExecuted) {
    return findStage(/\b(due diligence|diligence|underwriting|review)\b/)?.key
      || findStage(/\bloi|letter of intent\b/)?.key
      || safeStages[0].key;
  }
  return safeStages[0].key;
}

function buildDealRoomLifecycleFields({ transactionEntryMode, stages, generatedProposal }) {
  return {
    deal_stage: transactionEntryMode === TRANSACTION_ENTRY_MODES.PREVIOUSLY_COMPLETED
      ? historicalLifecycleStage(transactionEntryMode).key
      : generatedProposal
        ? inferGeneratedCurrentStage(stages, generatedProposal)
        : undefined,
    transaction_entry_mode: transactionEntryMode,
  };
}

module.exports = {
  buildDealRoomLifecycleFields,
  inferGeneratedCurrentStage,
};