/**
 * @typedef {Object} AiReviewInput
 * @property {string} orgId
 * @property {string | null} [loanId]
 * @property {string | null} [projectId]
 * @property {"payment" | "inspection"} type
 * @property {string} sourceId
 * @property {Array<{ label?: string, url?: string, kind?: string, excerpt?: string }>} [attachments]
 * @property {Record<string, any>} [context]
 */

/**
 * @typedef {Object} AiReviewReason
 * @property {string} code
 * @property {string} message
 * @property {"low" | "medium" | "high"} severity
 */

/**
 * @typedef {Object} AiReviewEvidence
 * @property {string} label
 * @property {string} url
 * @property {string} kind
 * @property {string} [excerpt]
 */

/**
 * @typedef {Object} AiReviewAction
 * @property {string} action_type
 * @property {string} label
 * @property {Record<string, any>} payload
 * @property {true} requires_approval
 */

/**
 * @typedef {Object} AiReviewOutput
 * @property {"pass" | "needs_review" | "fail"} status
 * @property {number} confidence
 * @property {string} title
 * @property {string} summary
 * @property {AiReviewReason[]} reasons
 * @property {AiReviewEvidence[]} evidence
 * @property {AiReviewAction[]} recommended_actions
 * @property {Record<string, any>} proposed_updates
 */

module.exports = {};
