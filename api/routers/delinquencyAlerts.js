const express = require('express');
const { sendEmail } = require('../communications');
const { supabase } = require('../db');
const authenticate = require('../middlewares/authenticate');
const { isAuthenticatedTenantMember } = require('../lib/tenantEmailAuthorization');
const { triggerWebhooks } = require('../webhooks');
let twilioClient;
try {
  twilioClient = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
} catch {
  twilioClient = null;
}

const router = express.Router();

router.post('/loans/:loanId/alerts/delinquency', authenticate, async (req, res) => {
  const { loanId } = req.params;
  const { message } = req.body || {};
  if (!req.orgId) return res.status(403).json({ message: 'Organization context required' });
  if (!await isAuthenticatedTenantMember(supabase, req)) {
    return res.status(403).json({ message: 'Organization access denied' });
  }
  const { data: loan, error } = await supabase.from('loans')
    .select('id, borrower_email, borrower_phone')
    .eq('id', loanId)
    .eq('organization_id', req.orgId)
    .maybeSingle();
  if (error) return res.status(500).json({ message: 'Unable to verify loan ownership' });
  if (!loan) return res.status(404).json({ message: 'Loan not found' });
  const email = loan.borrower_email;
  const phone = loan.borrower_phone;
  if (!email && !phone) return res.status(400).json({ message: 'Loan has no contact information' });
  const text = message || `Loan ${loanId} is delinquent. Please make a payment.`;
  const result = { email: false, sms: false };
  if (email) {
    try {
      await sendEmail(email, 'Delinquency Alert', text, [], { sendmail: true });
      result.email = true;
    } catch (err) {
      console.error('Email error:', err);
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
   await triggerWebhooks('payment.missed', { loanId });
  res.json({ sent: result });
});

module.exports = router;
