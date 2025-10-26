const express = require('express');
const crypto = require('crypto');
const { sendSms, sendEmail } = require('../communications');
const cache = require('../cache');
const { OTP_TTL_SECONDS } = require('../constants/otp');

const router = express.Router();

router.post('/request', async (req, res) => {
  const { channel, destination } = req.body || {};
  if (!destination) return res.status(400).json({ message: 'Missing destination' });
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hashed = crypto.createHash('sha256').update(code).digest('hex');
  await cache.set(`otp:${destination}`, hashed, OTP_TTL_SECONDS);
  const msg = `Your verification code is ${code}`;
  if (channel === 'sms') {
    await sendSms(destination, msg);
  } else {
    await sendEmail(destination, 'Verification Code', msg);
  }
  res.json({ sent: true });
});

router.post('/verify', async (req, res) => {
  const { destination, code } = req.body || {};
  if (!destination || !code) return res.status(400).json({ message: 'Missing fields' });
  const hashed = crypto.createHash('sha256').update(code).digest('hex');
  const stored = await cache.get(`otp:${destination}`);
  const verified = stored === hashed;
  if (verified) await cache.set(`otp:${destination}`, '', 0);
  res.json({ verified });
});

module.exports = router;
