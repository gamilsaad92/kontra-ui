const express = require('express');
const crypto = require('crypto');
const cache = require('../lib/cache');

const router = express.Router();

const OTP_TTL = parseInt(process.env.OTP_TTL_SEC || '300', 10);
const OTP_SALT = process.env.OTP_SALT || 'change-me';
const OTP_LEN = parseInt(process.env.OTP_DIGITS || '6', 10);

const hashOTP = (code) =>
  crypto.createHmac('sha256', OTP_SALT).update(String(code)).digest('hex');

const keyFor = (subject) => `otp:${subject}`;

router.post('/request', async (req, res) => {
  const { subject, channel = 'email' } = req.body || {};
  if (!subject) return res.status(400).json({ error: 'Missing subject' });

  const code = (Math.floor(Math.random() * 10 ** OTP_LEN))
    .toString()
    .padStart(OTP_LEN, '0');

  const digest = hashOTP(code);
  await cache.set(keyFor(subject), digest, OTP_TTL);

  return res.status(200).json({ ok: true, ttl: OTP_TTL });
});

router.post('/verify', async (req, res) => {
  const { subject, code } = req.body || {};
  if (!subject || !code) return res.status(400).json({ error: 'Missing subject or code' });

  const cached = await cache.get(keyFor(subject));
  if (!cached) return res.status(400).json({ ok: false, reason: 'expired_or_missing' });

  const match = cached === hashOTP(code);
  if (match) await cache.del(keyFor(subject));

  return res.status(200).json({ ok: match });
});

module.exports = router;
