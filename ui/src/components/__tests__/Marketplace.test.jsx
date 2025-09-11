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
    fireEvent.change(screen.getByPlaceholderText('Quantity'), { target: { value: '5' } });
    fireEvent.change(screen.getByPlaceholderText('Price'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/marketplace',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ask', symbol: 'AAA', quantity: 5, price: 10 })
      })
    );
    expect(onSubmitted).toHaveBeenCalled();
  });
});
