import { stripLegacyOwnerCredentials } from './apiRequestCredentials.mjs';

describe('legacy owner credential request cleanup', () => {
  test('removes owner credential headers and JSON fields but keeps the owner exchange input', () => {
    const safe = stripLegacyOwnerCredentials({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-owner-write-token': 'legacy-secret',
        'x-owner-token': 'legacy-secret',
        'x-kontra-session': 'participant-session',
      },
      body: JSON.stringify({
        ownerWriteToken: 'legacy-secret',
        ownerToken: 'legacy-secret',
        owner_token: 'legacy-secret',
        owner_write_token: 'legacy-secret',
        exchangeToken: 'one-use-exchange-capability',
        value: 'kept',
      }),
    });

    expect(safe.headers.has('x-owner-write-token')).toBe(false);
    expect(safe.headers.has('x-owner-token')).toBe(false);
    expect(safe.headers.get('x-kontra-session')).toBe('participant-session');
    expect(JSON.parse(safe.body)).toEqual({
      exchangeToken: 'one-use-exchange-capability',
      value: 'kept',
    });
  });
});
