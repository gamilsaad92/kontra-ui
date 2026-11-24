jest.mock('../db', () => ({
  supabase: { from: jest.fn() },
}));

const { sendResendEmail } = require('./dealRoomHelpers');

describe('Resend delivery logging', () => {
  const originalFetch = global.fetch;
  let infoSpy;
  let errorSpy;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn();
  });

  afterEach(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
    global.fetch = originalFetch;
  });

  it('logs provider acceptance without recipient or message content', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ id: 'provider-message-id' }),
    });

    await sendResendEmail('test-key', {
      to: 'buyer@example.test',
      subject: 'Private invitation subject',
      text: 'Private invitation body',
    });

    expect(infoSpy).toHaveBeenCalledWith('[resend-ok]', { status: 202 });
    const logged = JSON.stringify(infoSpy.mock.calls);
    expect(logged).not.toContain('buyer@example.test');
    expect(logged).not.toContain('Private invitation');
    expect(logged).not.toContain('provider-message-id');
  });

  it('logs provider rejection status without the provider body or recipient', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: 'Rejected recipient buyer@example.test' }),
    });

    await expect(sendResendEmail('test-key', {
      to: 'buyer@example.test',
      subject: 'Private invitation subject',
      text: 'Private invitation body',
    })).rejects.toThrow('Resend error 422');

    expect(errorSpy).toHaveBeenCalledWith('[resend-error]', { status: 422 });
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain('buyer@example.test');
    expect(logged).not.toContain('Rejected recipient');
    expect(logged).not.toContain('Private invitation');
  });
});
