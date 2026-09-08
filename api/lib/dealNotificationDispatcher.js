'use strict';

const { on } = require('./eventBus');
const { supabase } = require('../db');
const {
  sendResendEmail,
  getPackRoleLabel,
  resolvePackIdFromRoom,
} = require('./dealRoomHelpers');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://kontraplatform.com').replace(/\/$/, '');
const INACTIVE_STATUSES = new Set(['revoked', 'expired', 'removed', 'inactive', 'declined']);
const OPEN_TASK_STATUSES = new Set(['pending', 'in_progress', 'escalated']);

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizedEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isActiveParticipant(participant) {
  const email = normalizedEmail(participant?.email);
  const status = String(participant?.status || '').trim().toLowerCase();
  return Boolean(email) && !INACTIVE_STATUSES.has(status);
}

function buildRoomLink(propertyId, role, params = {}) {
  const query = new URLSearchParams({ role: role || 'owner' });
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') query.set(key, String(value));
  });
  return `${FRONTEND_URL}/deal-room/${encodeURIComponent(propertyId)}?${query.toString()}`;
}

function buildPackageLink(propertyId, role, packageId) {
  return buildRoomLink(propertyId, role, { package: packageId });
}

function buildIdempotencyKey(eventId, email) {
  return `${eventId}:${normalizedEmail(email)}`;
}

function isMaterialReadinessRegression(before = {}, after = {}) {
  const checks = [
    ['approvalReady', 'Transaction approval readiness'],
    ['fundReleaseReady', 'Fund release readiness'],
    ['digitalAssetSufficient', 'Digital Asset readiness'],
  ];
  return checks
    .filter(([key]) => before[key] === true && after[key] === false)
    .map(([key, label]) => ({ key, label }));
}

async function getRoomContext(propertyId) {
  const [roomResult, participantResult] = await Promise.all([
    supabase.from('deal_rooms')
      .select('property_id, customer_email, property_name, first_name, workflow_pack_id, deal_type')
      .eq('property_id', propertyId)
      .maybeSingle(),
    supabase.from('party_submissions')
      .select('email, name, role')
      .eq('property_id', propertyId),
  ]);
  if (roomResult?.error) throw roomResult.error;
  if (participantResult?.error) throw participantResult.error;
  return {
    room: roomResult?.data || null,
    participants: (participantResult?.data || []).filter(isActiveParticipant),
  };
}

function ownerRecipient(room) {
  const email = normalizedEmail(room?.customer_email);
  return email
    ? { email, name: room.first_name || 'there', role: 'owner' }
    : null;
}

function roleRecipient(room, participants, role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  if (!normalizedRole || normalizedRole === 'owner') return ownerRecipient(room);
  const participant = participants.find(item =>
    String(item.role || '').trim().toLowerCase() === normalizedRole,
  );
  return participant
    ? { email: normalizedEmail(participant.email), name: participant.name || normalizedRole, role: participant.role }
    : null;
}

function lifecycleRecipients(room, participants) {
  const recipients = [ownerRecipient(room), ...participants.map(participant => ({
    email: normalizedEmail(participant.email),
    name: participant.name || participant.role || 'there',
    role: participant.role,
  }))].filter(Boolean);
  const seen = new Set();
  return recipients.filter(recipient => {
    if (seen.has(recipient.email)) return false;
    seen.add(recipient.email);
    return true;
  });
}

async function getOpenActions(propertyId, role) {
  try {
    const { data, error } = await supabase.from('deal_room_tasks')
      .select('title, owner_role, status, blocking')
      .eq('property_id', propertyId);
    if (error) throw error;
    return (data || [])
      .filter(task => OPEN_TASK_STATUSES.has(String(task.status || '').toLowerCase()))
      .filter(task => task.blocking === true)
      .filter(task => String(task.owner_role || '').toLowerCase() === String(role || '').toLowerCase())
      .map(task => task.title)
      .filter(Boolean)
      .slice(0, 5);
  } catch (error) {
    console.warn('[deal-notifications] open-action lookup skipped:', error.message);
    return [];
  }
}

function notificationHtml({ title, greeting, body, link, ctaLabel = 'Open Workspace' }) {
  return `<div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px">
    <h2 style="color:#800020;margin-bottom:4px">${escapeHtml(title)}</h2>
    <p style="color:#555">Hi ${escapeHtml(greeting || 'there')},</p>
    <div style="color:#555;line-height:1.55">${body}</div>
    <a href="${escapeHtml(link)}" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#800020;color:white;border-radius:8px;text-decoration:none;font-weight:bold">${escapeHtml(ctaLabel)} →</a>
    <p style="color:#aaa;font-size:12px;margin-top:24px">Kontra · Transaction Intelligence</p>
  </div>`;
}

async function createDeliveryRecord({
  propertyId,
  event,
  recipient,
  type,
  subject,
  link,
  metadata,
}) {
  const idempotencyKey = buildIdempotencyKey(event.id, recipient.email);
  const { data, error } = await supabase.from('deal_notifications').insert({
    property_id: propertyId,
    type,
    event_id: event.id,
    event_type: event.type,
    idempotency_key: idempotencyKey,
    to_email: recipient.email,
    subject,
    link,
    metadata: metadata || {},
    delivery_status: 'pending',
    sent_at: new Date().toISOString(),
  }).select('id').single();

  if (!error) return data?.id || null;
  if (error.code === '23505' || /duplicate|unique/i.test(error.message || '')) {
    return null;
  }
  if (/column|schema cache|deal_notifications.*(?:does not exist|not found)|relation/i.test(error.message || '')) {
    console.warn('[deal-notifications] migration 028 is required before event emails can be sent:', error.message);
    return null;
  }
  throw error;
}

async function updateDelivery(deliveryId, patch) {
  if (!deliveryId) return;
  const { error } = await supabase.from('deal_notifications')
    .update(patch)
    .eq('id', deliveryId);
  if (error) console.warn('[deal-notifications] delivery status update failed:', error.message);
}

async function deliverNotification({ propertyId, event, recipient, type, subject, body, link, metadata }) {
  let deliveryId;
  try {
    deliveryId = await createDeliveryRecord({
      propertyId,
      event,
      recipient,
      type,
      subject,
      link,
      metadata,
    });
    // A null claim means the same event/recipient was already claimed, or the
    // additive notification migration is not present. Never send without a
    // durable idempotency claim.
    if (!deliveryId) return { skipped: true };

    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not configured');
    await sendResendEmail(key, {
      from: 'Kontra <notifications@kontraplatform.com>',
      to: recipient.email,
      subject,
      html: notificationHtml({
        title: body.title,
        greeting: recipient.name,
        body: body.html,
        link,
        ctaLabel: body.ctaLabel,
      }),
    });
    await updateDelivery(deliveryId, {
      delivery_status: 'delivered',
      delivered_at: new Date().toISOString(),
      error_message: null,
    });
    return { delivered: true };
  } catch (error) {
    console.warn('[deal-notifications] delivery failed:', error.message);
    await updateDelivery(deliveryId, {
      delivery_status: 'failed',
      error_message: error.message,
    });
    return { delivered: false, error: error.message };
  }
}

async function deliverToRecipients({ propertyId, event, recipients, type, subject, bodyForRecipient }) {
  await Promise.allSettled(recipients.map(async recipient => {
    const payload = await bodyForRecipient(recipient);
    return deliverNotification({
      propertyId,
      event,
      recipient,
      type,
      subject: typeof subject === 'function' ? subject(recipient) : subject,
      body: payload,
      link: payload.link,
      metadata: payload.metadata,
    });
  }));
}

async function dispatchTransactionEvent(event) {
  const data = event.data || {};
  const propertyId = data.propertyId;
  const eventType = data.eventType;
  if (!propertyId || !eventType) return;

  const context = await getRoomContext(propertyId);
  if (!context.room) return;
  const { room, participants } = context;
  const propName = room.property_name || propertyId;

  if (eventType === 'stage_advanced') {
    const stageLabel = data.metadata?.stageLabel || data.metadata?.stage || 'a new stage';
    const previousStage = data.metadata?.previousStage || 'the prior stage';
    const subject = `Deal advanced to ${stageLabel} — ${propName}`;
    const recipients = lifecycleRecipients(room, participants);
    await deliverToRecipients({
      propertyId,
      event,
      recipients,
      type: 'stage_transition',
      subject,
      bodyForRecipient: async recipient => {
        const actions = await getOpenActions(propertyId, recipient.role);
        const actionHtml = actions.length
          ? `<p>Blocking actions assigned to you:</p><ul>${actions.map(action => `<li>${escapeHtml(action)}</li>`).join('')}</ul>`
          : '';
        return {
          title: 'Deal stage updated',
          html: `<p>The transaction <strong>${escapeHtml(propName)}</strong> advanced from <strong>${escapeHtml(previousStage)}</strong> to <strong>${escapeHtml(stageLabel)}</strong>.</p>${actionHtml}`,
          link: buildRoomLink(propertyId, recipient.role, { stage: data.metadata?.stage }),
          metadata: { previous_stage: previousStage, new_stage: data.metadata?.stage || stageLabel },
        };
      },
    });
    return;
  }

  if (eventType === 'verified_asset_snapshot_created' && data.metadata?.eligibility === 'eligible') {
    const subject = `Verified Asset milestone reached — ${propName}`;
    await deliverToRecipients({
      propertyId,
      event,
      recipients: lifecycleRecipients(room, participants),
      type: 'verified_asset_milestone',
      subject,
      bodyForRecipient: recipient => ({
        title: 'Verified Asset milestone reached',
        html: `<p>The transaction <strong>${escapeHtml(propName)}</strong> reached a meaningful verified state. The eligible readiness snapshot is now available for authorized review.</p>`,
        link: buildRoomLink(propertyId, recipient.role, { tab: 'overview' }),
        metadata: { snapshot_version: data.metadata?.version || null },
      }),
    });
    return;
  }

  if (eventType === 'digital_asset_preparation_package_created') {
    const packageId = data.metadata?.package_id;
    const subject = `Preparation package generated — ${propName}`;
    await deliverToRecipients({
      propertyId,
      event,
      recipients: lifecycleRecipients(room, participants),
      type: 'package_generated',
      subject,
      bodyForRecipient: recipient => ({
        title: 'Preparation package ready',
        html: `<p>A provider-neutral preparation package for <strong>${escapeHtml(propName)}</strong> was generated from an immutable readiness snapshot. It does not issue, sell, custody, or settle digital assets.</p>`,
        link: buildPackageLink(propertyId, recipient.role, packageId),
        ctaLabel: 'Open Package',
        metadata: { package_id: packageId || null, source_snapshot_version: data.metadata?.source_snapshot_version || null },
      }),
    });
    return;
  }

  if (eventType === 'transaction_sealed') {
    const subject = `Transaction completed — ${propName}`;
    await deliverToRecipients({
      propertyId,
      event,
      recipients: lifecycleRecipients(room, participants),
      type: 'lifecycle_completed',
      subject,
      bodyForRecipient: recipient => ({
        title: 'Transaction completed',
        html: `<p>The transaction <strong>${escapeHtml(propName)}</strong> has reached its major completion milestone. The sealed record is available to authorized workspace participants.</p>`,
        link: buildRoomLink(propertyId, recipient.role, { tab: 'overview' }),
        metadata: { seal_id: data.metadata?.seal_id || null },
      }),
    });
  }
}

async function dispatchBlockingTask(event) {
  const data = event.data || {};
  if (!data.propertyId || data.blocking !== true) return;
  const context = await getRoomContext(data.propertyId);
  if (!context.room) return;
  const recipient = roleRecipient(context.room, context.participants, data.ownerRole || data.requiredApproverRole);
  if (!recipient) return;
  const propName = context.room.property_name || data.propertyId;
  const roleLabel = getPackRoleLabel(resolvePackIdFromRoom(context.room), recipient.role);
  await deliverNotification({
    propertyId: data.propertyId,
    event,
    recipient,
    type: 'blocking_action_assigned',
    subject: `New blocking action assigned — ${propName}`,
    body: {
      title: 'New blocking action assigned',
      html: `<p>A blocking action was assigned to you as <strong>${escapeHtml(roleLabel)}</strong> in <strong>${escapeHtml(propName)}</strong>.</p><p><strong>${escapeHtml(data.title || 'Review the assigned action')}</strong></p>`,
      ctaLabel: 'Open Action',
    },
    link: buildRoomLink(data.propertyId, recipient.role, { task: data.taskId }),
    metadata: { task_id: data.taskId, task_type: data.taskType, owner_role: data.ownerRole },
  });
}

async function dispatchReadinessRegression(event) {
  const data = event.data || {};
  const regressions = isMaterialReadinessRegression(data.beforeReadiness, data.readiness);
  if (!data.propertyId || regressions.length === 0) return;
  const context = await getRoomContext(data.propertyId);
  if (!context.room) return;
  const propName = context.room.property_name || data.propertyId;
  const labels = regressions.map(item => item.label).join(', ');
  await deliverToRecipients({
    propertyId: data.propertyId,
    event,
    recipients: lifecycleRecipients(context.room, context.participants),
    type: 'readiness_regression',
    subject: `Readiness requires attention — ${propName}`,
    bodyForRecipient: recipient => ({
      title: 'Readiness regression detected',
      html: `<p>Previously satisfied readiness state for <strong>${escapeHtml(propName)}</strong> materially changed: <strong>${escapeHtml(labels)}</strong> now requires attention.</p><p>Review the current evidence and assigned actions before relying on the earlier status.</p>`,
      link: buildRoomLink(data.propertyId, recipient.role, { tab: 'overview' }),
      metadata: { regressions: regressions.map(item => item.key), source: data.source || null },
    }),
  });
}

function startDealNotificationDispatcher() {
  if (startDealNotificationDispatcher.started) return;
  startDealNotificationDispatcher.started = true;
  on('transaction.event', event => {
    dispatchTransactionEvent(event).catch(error =>
      console.warn('[deal-notifications] transaction dispatch failed:', error.message));
  });
  on('task.created', event => {
    dispatchBlockingTask(event).catch(error =>
      console.warn('[deal-notifications] task dispatch failed:', error.message));
  });
  on('transaction_state.recalculated', event => {
    dispatchReadinessRegression(event).catch(error =>
      console.warn('[deal-notifications] readiness dispatch failed:', error.message));
  });
}

module.exports = {
  startDealNotificationDispatcher,
  buildRoomLink,
  buildPackageLink,
  buildIdempotencyKey,
  isActiveParticipant,
  isMaterialReadinessRegression,
};