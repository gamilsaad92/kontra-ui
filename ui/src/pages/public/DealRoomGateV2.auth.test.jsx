jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      verifyOtp: (...args) => mockVerifyOtp(...args),
    },
  },
}));

jest.mock('../../lib/inviteUtils', () => ({
  clearInviteCredentialsFromUrl: (...args) => mockClearInviteCredentialsFromUrl(...args),
}));

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DealRoomGateV2 from './DealRoomGateV2';

const mockVerifyOtp = jest.fn();
const mockClearInviteCredentialsFromUrl = jest.fn();

describe('V2 invitation resolution privacy and OTP continuation', () => {
  beforeEach(() => {
    mockVerifyOtp.mockReset();
    mockClearInviteCredentialsFromUrl.mockReset();
    global.fetch = jest.fn(async (url, options = {}) => {
      const body = JSON.parse(options.body || '{}');
      if (url.endsWith('/invite/resolve')) {
        return {
          ok: true,
          json: async () => ({ valid: true, masked_email: 'p***@example.test' }),
        };
      }
      if (url.endsWith('/invite/request-otp')) {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      if (url.endsWith('/invite/accept')) {
        expect(body.token).toBe('bearer-invite-token');
        expect(options.headers.Authorization).toBe('Bearer participant-access-token');
        return {
          ok: true,
          json: async () => ({ ok: true, room_id: 'room-1', role_key: 'seller' }),
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
  });

  it('keeps private invite fields out of the browser flow and accepts a valid OTP session', async () => {
    const session = {
      access_token: 'participant-access-token',
      user: { email: 'recipient@example.test' },
    };
    mockVerifyOtp.mockResolvedValue({ data: { session }, error: null });
    const onVerified = jest.fn();

    render(
      <DealRoomGateV2
        roomId="room-1"
        inviteToken="bearer-invite-token"
        onVerified={onVerified}
      />,
    );

    expect(await screen.findByText('Enter the email address this invitation was sent to.')).toBeTruthy();
    expect(screen.getByText('p***@example.test')).toBeTruthy();
    expect(screen.queryByText(/recipient@example\.test/)).toBeNull();
    expect(screen.queryByText(/seller|Sensitive Deal/i)).toBeNull();
    expect(global.fetch.mock.calls[0][1].body).toBe(JSON.stringify({ token: 'bearer-invite-token' }));

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'Recipient@Example.Test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send verification code →' }));
    expect(await screen.findByText('Check your email')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('000000'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify →' }));

    await waitFor(() => expect(onVerified).toHaveBeenCalledWith(session, 'seller', 'room-1'));
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'recipient@example.test',
      token: '123456',
      type: 'email',
    });
    expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({
      token: 'bearer-invite-token',
    });
    expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/v2/deal-room/invite/resolve',
      '/api/v2/deal-room/invite/request-otp',
      '/api/v2/deal-room/invite/accept',
    ]);
    expect(mockClearInviteCredentialsFromUrl).toHaveBeenCalled();
  });
});
