const OpenAI = require('openai');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

async function sendEmail(to, subject, text) {
  if (!process.env.SMTP_HOST) {
    console.log('Email to', to, subject, text);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
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

async function notifyInApp(user_id, message, link) {
  await supabase.from('notifications').insert([{ user_id, message, link }]);
}

module.exports = { generateReminder, sendEmail, sendSms, notifyInApp };
