jest.mock('../cache', () => ({
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
}));

jest.mock('../communications', () => ({
  sendSms: jest.fn().mockResolvedValue(undefined),
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

const cache = require('../cache');
const communications = require('../communications');
const { OTP_TTL_SECONDS } = require('../constants/otp');
const router = require('./otp');

function getRouteHandler(method, path) {
  const layer = router.stack.find(
    (entry) => entry.route && entry.route.path === path && entry.route.methods[method.toLowerCase()]
  );
  if (!layer) throw new Error(`Handler not found for [${method}] ${path}`);
  return layer.route.stack[0].handle;
}

describe('otp router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stores OTPs using the shared TTL', async () => {
    const handler = getRouteHandler('post', '/request');
    const json = jest.fn();
    const res = {
      status: jest.fn().mockReturnThis(),
      json,
    };

    await handler({ body: { channel: 'email', destination: 'user@example.com' } }, res);

    expect(cache.set).toHaveBeenCalledWith(
      'otp:user@example.com',
      expect.any(String),
      OTP_TTL_SECONDS
    );
    expect(communications.sendEmail).toHaveBeenCalledWith(
      'user@example.com',
      'Verification Code',
      expect.stringMatching(/^Your verification code is \d{6}$/)
    );
    expect(json).toHaveBeenCalledWith({ sent: true });
  });
});
