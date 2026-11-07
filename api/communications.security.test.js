'use strict';

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));
const mockDispatchPortfolioCampaign = jest.fn(async ({ borrower }) => ({
  emailText: 'campaign',
  smsText: 'campaign',
  channelsUsed: borrower.email ? ['email'] : [],
}));
let mockLoan = null;

jest.mock('nodemailer', () => ({ createTransport: mockCreateTransport }));
jest.mock('openai', () => jest.fn().mockImplementation(() => ({
  chat: { completions: { create: jest.fn() } },
})));
jest.mock('twilio', () => jest.fn(() => ({ messages: { create: jest.fn() } })));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: jest.fn() })),
}));
jest.mock('./db', () => ({
  supabase: {
    from: jest.fn((table) => {
      let organizationId;
      const query = {
        select: jest.fn(() => query),
        eq: jest.fn((field, value) => {
          if (field === 'organization_id' || field === 'org_id') organizationId = value;
          return query;
        }),
        maybeSingle: jest.fn(async () => ({
          data: table === 'organization_members'
            ? (organizationId === 'org-a' ? { user_id: 'user-a' } : null)
            : mockLoan,
          error: null,
        })),
      };
      return query;
    }),
  },
}));
jest.mock('./middlewares/authenticate', () => (req, _res, next) => {
  req.orgId = req.headers['x-test-org'] || 'org-a';
  req.user = { id: 'user-a' };
  next();
});
jest.mock('./webhooks', () => ({ triggerWebhooks: jest.fn() }));
jest.mock('./communications', () => ({
  sendEmail: jest.fn(),
  dispatchPortfolioCampaign: (...args) => mockDispatchPortfolioCampaign(...args),
}));

const express = require('express');
const request = require('supertest');
const nodemailer = require('nodemailer');
const mockedCommunications = require('./communications');
const communicationsRouter = require('./routers/communicationsLog');
const delinquencyRouter = require('./routers/delinquencyAlerts');
const { supabase } = require('./db');
const app = express();
app.use(express.json());
app.use('/api', communicationsRouter);
app.use('/api', delinquencyRouter);

describe('Nodemailer input and delivery boundaries', () => {
  let sendEmailImpl;

  beforeAll(() => {
    sendEmailImpl = jest.requireActual('./communications').sendEmail;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_FROM = 'Kontra <notifications@example.test>';
    mockLoan = { id: 'loan-a', borrower_name: 'A', borrower_email: 'borrower@example.test', borrower_phone: null };
  });

  afterEach(() => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
  });

  test('accepts a single valid address and preserves in-memory PDF attachments', async () => {
    await sendEmailImpl('borrower@example.test', 'Draw summary', 'Attached', [
      { filename: 'draw-summary.pdf', content: Buffer.from('%PDF') },
    ]);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.example.test',
      disableFileAccess: true,
      disableUrlAccess: true,
    }));
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'borrower@example.test',
      attachments: [{ filename: 'draw-summary.pdf', content: Buffer.from('%PDF') }],
      disableFileAccess: true,
      disableUrlAccess: true,
    }));
  });

  test.each([
    ['multiple recipients', ['a@example.test', 'b@example.test']],
    ['header injection', 'a@example.test\r\nBcc: other@example.test'],
    ['comment syntax', 'borrower(comment)@example.test'],
    ['missing domain', 'borrower@'],
  ])('rejects %s before transport', async (_label, address) => {
    await expect(sendEmailImpl(address, 'Subject', 'Text')).rejects.toThrow();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  test('rejects subject header injection and remote/path attachments', async () => {
    await expect(sendEmailImpl('a@example.test', 'ok\r\nBcc: x@example.test', 'Text')).rejects.toThrow();
    await expect(sendEmailImpl('a@example.test', 'Subject', 'Text', [
      { filename: 'report.pdf', path: '/tmp/report.pdf' },
    ])).rejects.toThrow();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  test('surfaces SMTP delivery errors to the caller', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP unavailable'));
    await expect(sendEmailImpl('a@example.test', 'Subject', 'Text')).rejects.toThrow('SMTP unavailable');
  });

  test('campaign recipient is loaded from the authenticated tenant loan, not request body', async () => {
    const response = await request(app).post('/api/send-communication')
      .set('x-test-org', 'org-a')
      .send({
        loanId: 'loan-a',
        borrower: { email: 'other-tenant@example.test', phone: 'spoofed' },
        event: { name: 'payment_due' },
      });
    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith('loans');
    expect(mockDispatchPortfolioCampaign).toHaveBeenCalledWith(expect.objectContaining({
      borrower: expect.objectContaining({ email: 'borrower@example.test' }),
    }));
  });

  test('a loan outside the authenticated tenant cannot trigger an email campaign', async () => {
    mockLoan = null;
    const response = await request(app).post('/api/send-communication')
      .set('x-test-org', 'org-a')
      .send({ loanId: 'loan-a', borrower: { email: 'attacker@example.test' } });
    expect(response.status).toBe(404);
    expect(mockDispatchPortfolioCampaign).not.toHaveBeenCalled();
  });

  test('delinquency alerts use the authenticated tenant loan recipient', async () => {
    const response = await request(app).post('/api/loans/loan-a/alerts/delinquency')
      .set('x-test-org', 'org-a')
      .send({ email: 'other-tenant@example.test', message: 'Payment due' });
    expect(response.status).toBe(200);
    expect(mockedCommunications.sendEmail).toHaveBeenCalledWith(
      'borrower@example.test',
      'Delinquency Alert',
      'Payment due',
      [],
      { sendmail: true, from: 'Kontra <notifications@kontraplatform.com>' },
    );
  });

  test('a loan outside the authenticated tenant cannot trigger a delinquency email', async () => {
    mockLoan = null;
    const response = await request(app).post('/api/loans/loan-a/alerts/delinquency')
      .set('x-test-org', 'org-a')
      .send({ email: 'attacker@example.test' });
    expect(response.status).toBe(404);
    expect(mockedCommunications.sendEmail).not.toHaveBeenCalled();
  });
});
