import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Marketplace from '../trades/Marketplace';

describe('Marketplace component', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
  });
  afterEach(() => jest.resetAllMocks());

  it('submits marketplace entry', async () => {
    const onSubmitted = jest.fn();
    render(<Marketplace entries={[]} onSubmitted={onSubmitted} />);
    fireEvent.change(screen.getByLabelText(/entry type/i), { target: { value: 'ask' } });
    fireEvent.change(screen.getByPlaceholderText('Symbol'), { target: { value: 'AAA' } });
    fireEvent.change(screen.getByPlaceholderText('Loan ID'), { target: { value: 'LN-1' } });
    fireEvent.change(screen.getByPlaceholderText('Loan Name'), { target: { value: 'Seaport Loan' } });
    fireEvent.change(screen.getByPlaceholderText('Quantity (fractional units)'), { target: { value: '5' } });
    fireEvent.change(screen.getByPlaceholderText('Price (USDC)'), { target: { value: '10' } });
    fireEvent.change(screen.getByPlaceholderText('Expected APY (%)'), { target: { value: '8.5' } });
    fireEvent.change(screen.getByPlaceholderText('Investor Wallet (Base)'), { target: { value: '0xabc' } });
    fireEvent.click(screen.getByRole('button', { name: /post order/i }));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/marketplace',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
          type: 'ask',
          symbol: 'AAA',
          quantity: 5,
          price: 10,
          settlementType: 'p2p',
          stablecoin: 'USDC',
          loanId: 'LN-1',
          loanName: 'Seaport Loan',
          expectedApy: 8.5,
          payoutFrequency: 'monthly',
          walletAddress: '0xabc',
        }),
      })
    );
    expect(onSubmitted).toHaveBeenCalled();
  });
});
