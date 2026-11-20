jest.mock('../lib/cache', () => ({
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(undefined),
}));

const cache = require('../lib/cache');
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

  it('stores a hashed OTP using the configured TTL without exposing the code', async () => {
    const handler = getRouteHandler('post', '/request');
    const json = jest.fn();
    const res = {
      status: jest.fn().mockReturnThis(),
      json,
    };

    await handler({ body: { channel: 'email', subject: 'user@example.com' } }, res);

    const [key, digest, ttl] = cache.set.mock.calls[0];
    expect(key).toBe('otp:user@example.com');
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(ttl).toBe(Number(process.env.OTP_TTL_SEC || '300'));
    expect(json).toHaveBeenCalledWith({ ok: true, ttl });
  });
});
