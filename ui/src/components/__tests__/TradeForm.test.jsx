import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TradeForm from '../trades/TradeForm';
import TradeList from '../trades/TradeList';

describe('Trade UI', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('submits trade with new fields', async () => {
    const onSubmitted = jest.fn();
    render(<TradeForm onSubmitted={onSubmitted} />);

    fireEvent.change(screen.getByLabelText(/trade type/i), { target: { value: 'repo' } });
    fireEvent.change(screen.getByLabelText(/notional amount/i), { target: { value: '1000' } });
    fireEvent.change(screen.getByPlaceholderText('Symbol'), { target: { value: 'AAPL' } });
    fireEvent.change(screen.getByPlaceholderText('Quantity'), { target: { value: '10' } });
    fireEvent.change(screen.getByPlaceholderText('Price'), { target: { value: '150' } });
    fireEvent.change(screen.getByPlaceholderText(/Counterparties/), { target: { value: 'CP-1' } });
    fireEvent.click(screen.getByRole('button', { name: /submit trade/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/trades',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade_type: 'repo',
          notional_amount: 1000,
          symbol: 'AAPL',
          quantity: 10,
          price: 150,
          side: 'buy',
          counterparties: ['CP-1'],
        }),
      })
    );
    expect(onSubmitted).toHaveBeenCalled();
  });

  it('calls onSettle when settle button clicked', () => {
    const onSettle = jest.fn();
    render(
      <TradeList
        title="Open Trades"
        trades={[{
          id: 1,
          trade_type: 'repo',
          notional_amount: 1000,
          symbol: 'AAPL',
          quantity: 10,
          price: 150,
          side: 'buy',
          status: 'pending',
        }]}
        onSettle={onSettle}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /settle/i }));
    expect(onSettle).toHaveBeenCalledWith(1);
  });
});
