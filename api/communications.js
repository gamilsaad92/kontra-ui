const OpenAI = require('openai');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');
const { domainToASCII } = require('node:url');
const { supabase: fallbackSupabase } = require('./db');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'sk-not-configured' });
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : fallbackSupabase;

async function generateReminder({ borrower_name, loan_status, risk_score, history }) {
  const prompt = `Draft a short friendly reminder email and SMS for borrower ${borrower_name}. Loan status is ${loan_status}. Risk score is ${risk_score}. Borrower history: ${history || 'none'}. Separate email and sms sections with \n---SMS---\n.`;
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You generate concise customer communications.' },
      { role: 'user', content: prompt }
    ]
  });
  const text = res.choices[0].message.content || '';
  const [emailText, smsText] = text.split('---SMS---');
  return { emailText: emailText.trim(), smsText: (smsText || emailText).trim() };
}

function summarizePortfolioEvent(event = {}) {
  const parts = [
    event.name || 'portfolio update',
    event.severity ? `severity: ${event.severity}` : null,
    event.metric ? `metric: ${event.metric}` : null,
    event.delta ? `delta: ${event.delta}` : null,
    event.recommendation || null
  ].filter(Boolean);
  return parts.join(' | ');
}

async function generatePortfolioCampaign({ borrower_name, event }) {
  const prompt = `Write a concise borrower update based on a portfolio event. Include a subject line, a 4-5 sentence email, and a 1-2 sentence SMS.
Borrower: ${borrower_name || 'Borrower'}
Event: ${summarizePortfolioEvent(event)}
Tone: proactive, reassuring, and specific.
Return the response as:
Subject: ...
Email: ...
---SMS---
SMS: ...`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You craft multi-channel borrower communications tied to lending portfolio events.' },
      { role: 'user', content: prompt }
    ]
  });

  const text = res.choices[0].message.content || '';
  const subjectLine = text.match(/Subject:\s*(.*)/i)?.[1] || 'Portfolio update';
  const [emailBlock, smsBlock] = text.split('---SMS---');
  const emailText = (emailBlock || '').replace(/Subject:\s*.*\n?/i, '').replace(/^Email:\s*/i, '').trim();
  const smsText = (smsBlock || text).replace(/^SMS:\s*/i, '').trim();

  return { subject: subjectLine.trim(), emailText, smsText };
}

function normalizeEmailRecipient(value) {
  if (typeof value !== 'string') throw new TypeError('A single email address is required');
  const email = value.trim();
  if (email.length > 254 || /[\r\n\0,;<>]/.test(email)) throw new TypeError('Invalid email address');
  const at = email.lastIndexOf('@');
  if (at < 1 || at !== email.indexOf('@')) throw new TypeError('Invalid email address');
  const local = email.slice(0, at);
  const domain = domainToASCII(email.slice(at + 1).toLowerCase());
  if (local.length > 64
    || !/^[A-Z0-9!#$%&'*+/=?^_`{|}~.-]+$/i.test(local)
    || local.startsWith('.') || local.endsWith('.') || local.includes('..')
    || !domain || domain.length > 253
    || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)) {
    throw new TypeError('Invalid email address');
  }
  return `${local}@${domain}`;
}

function validateEmailMessage(to, subject, attachments = []) {
  const recipient = normalizeEmailRecipient(to);
  if (typeof subject !== 'string' || subject.length > 200 || /[\r\n\0]/.test(subject)) {
    throw new TypeError('Invalid email subject');
  }
  if (!Array.isArray(attachments) || attachments.length > 10) {
    throw new TypeError('Invalid email attachments');
  }
  let totalBytes = 0;
  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== 'object'
      || typeof attachment.filename !== 'string'
      || /[\r\n\0/\\\\]/.test(attachment.filename)
      || !(Buffer.isBuffer(attachment.content) || typeof attachment.content === 'string')
      || 'path' in attachment || 'href' in attachment || 'raw' in attachment) {
      throw new TypeError('Invalid email attachment');
    }
    totalBytes += Buffer.isBuffer(attachment.content)
      ? attachment.content.length
      : Buffer.byteLength(attachment.content);
  }
  if (totalBytes > 25 * 1024 * 1024) throw new TypeError('Email attachments exceed the size limit');
  return { recipient, attachments };
}

async function sendEmail(to, subject, text, attachments = [], { sendmail = false, from } = {}) {
  const validated = validateEmailMessage(to, subject, attachments);
  if (from !== undefined && (typeof from !== 'string' || /[\r\n\0]/.test(from))) {
    throw new TypeError('Invalid sender header');
  }
  if (!sendmail && !process.env.SMTP_HOST) {
    console.warn('SMTP is not configured; email delivery skipped');
    return;
  }
  const transporter = nodemailer.createTransport(sendmail
    ? { sendmail: true, disableFileAccess: true, disableUrlAccess: true }
    : {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  await transporter.sendMail({
    from: from || process.env.SMTP_FROM,
    to: validated.recipient,
    subject,
    text,
    attachments: validated.attachments,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

async function sendSms(to, body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken || !process.env.TWILIO_FROM) {
    console.log('SMS to', to, body);
    return;
  }
  const client = twilio(accountSid, authToken);
  await client.messages.create({ from: process.env.TWILIO_FROM, to, body });
}

async function sendPush(token, title, body) {
  if (!process.env.FCM_SERVER_KEY) {
    console.log('Push to', token, title, body);
    return;
  }
  // Placeholder: integrate FCM or Expo push in production
}

async function notifyInApp(user_id, message, link) {
  await supabase.from('notifications').insert([{ user_id, message, link }]);
}

async function dispatchPortfolioCampaign({ borrower = {}, loanId, event = {}, channels = {} }) {
  const { name: borrower_name, email, phone, user_id, pushToken } = borrower;
  if (!email && !phone && !user_id && !pushToken) {
    throw new Error('At least one contact method is required.');
  }

  let subject = 'Portfolio update';
  let emailText = `We recorded a portfolio event${loanId ? ` on loan ${loanId}` : ''}.`;
  let smsText = 'We recorded a servicing update. Reply if you have questions.';

  try {
    const ai = await generatePortfolioCampaign({ borrower_name, event });
    subject = ai.subject || subject;
    emailText = ai.emailText || emailText;
    smsText = ai.smsText || smsText;
  } catch (err) {
    console.warn('AI campaign generation failed, using defaults:', err.message);
  }

  const usedChannels = [];
  if (channels.email !== false && email) {
    await sendEmail(email, subject, emailText);
    usedChannels.push('email');
  }
  if (channels.sms !== false && phone) {
    await sendSms(phone, smsText);
    usedChannels.push('sms');
  }
  if (channels.push !== false && pushToken) {
    await sendPush(pushToken, subject, smsText);
    usedChannels.push('push');
  }
  if (user_id) {
    await notifyInApp(user_id, smsText || emailText, event.link || '/dashboard');
    usedChannels.push('in-app');
  }

  return {
    subject,
    emailText,
    smsText,
    eventName: event.name || 'portfolio_event',
    loanId,
    channelsUsed: usedChannels,
    summary: summarizePortfolioEvent(event),
  };
}

module.exports = {
  generateReminder,
  sendEmail,
  normalizeEmailRecipient,
  validateEmailMessage,
  sendSms,
  sendPush,
  notifyInApp,
  dispatchPortfolioCampaign,
};
