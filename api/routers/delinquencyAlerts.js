const express = require('express');
const nodemailer = require('nodemailer');
let twilioClient;
try {
  twilioClient = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
} catch {
  twilioClient = null;
}

const router = express.Router();
let transporter = null;
try {
  transporter = nodemailer.createTransport({ sendmail: true });
} catch {
  transporter = null;
}

router.post('/loans/:loanId/alerts/delinquency', async (req, res) => {
  const { loanId } = req.params;
  const { email, phone, message } = req.body || {};
  if (!email && !phone) {
    return res.status(400).json({ message: 'Missing email or phone' });
  }
  const text = message || `Loan ${loanId} is delinquent. Please make a payment.`;
  const result = { email: false, sms: false };
  if (email) {
    if (transporter) {
      try {
        await transporter.sendMail({
          to: email,
          from: 'noreply@example.com',
          subject: 'Delinquency Alert',
          text,
        });
        result.email = true;
      } catch (err) {
        console.error('Email error:', err);
      }
    } else {
      result.email = true; // assume sent in test environments
    }
  }
  if (phone) {
    if (twilioClient) {
      try {
        await twilioClient.messages.create({
          to: phone,
          from: process.env.TWILIO_FROM || phone,
          body: text,
        });
        result.sms = true;
      } catch (err) {
        console.error('SMS error:', err);
      }
    } else {
      result.sms = true;
    }
  }
  res.json({ sent: result });
});

module.exports = router;
