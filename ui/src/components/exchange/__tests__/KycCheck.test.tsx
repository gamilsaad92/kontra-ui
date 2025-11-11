import React from 'react';
import { render, screen } from '@testing-library/react';
import KycCheck from '../KycCheck';

describe('KycCheck', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'approved' })
      }) as unknown as Promise<Response>
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('shows approved status when the KYC check succeeds', async () => {
    render(<KycCheck />);

    expect(await screen.findByText('KYC verified')).toBeInTheDocument();
  });
});
