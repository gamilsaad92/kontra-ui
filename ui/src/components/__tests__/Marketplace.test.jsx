import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { waitFor } from '@testing-library/react';
import { api } from '../../lib/apiClient';
import Marketplace from '../trades/Marketplace';

jest.mock('../../lib/apiClient', () => ({
  api: { post: jest.fn() },
}));

describe('Marketplace component', () => {
  beforeEach(() => {
    api.post.mockResolvedValue({ data: {} });
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
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      '/marketplace',
      {
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
      },
    ));
    expect(onSubmitted).toHaveBeenCalled();
  });
});
