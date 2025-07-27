import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExtraPaymentCalculator from '../ExtraPaymentCalculator.jsx';

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          loan: {
            amount: 10000,
            interest_rate: 5,
            term_months: 24,
            start_date: '2023-01-01'
          }
        })
    })
  );
});

afterEach(() => {
  jest.resetAllMocks();
});

test('shows payoff date and interest saved when extra payment entered', async () => {
  render(<ExtraPaymentCalculator loanId={1} />);

  await waitFor(() => expect(fetch).toHaveBeenCalled());

  const input = screen.getByPlaceholderText(/Extra Monthly Payment/i);
  fireEvent.change(input, { target: { value: '100' } });

  await waitFor(() => {
    expect(screen.getByText(/New Payoff Date/i)).toBeInTheDocument();
    expect(screen.getByText(/Interest Saved/i)).toBeInTheDocument();
  });
});
