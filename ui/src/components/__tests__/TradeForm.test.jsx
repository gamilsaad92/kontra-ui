import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TradeForm from '../trades/TradeForm';
import TradeList from '../trades/TradeList';

describe('Trade UI', () => {
const definition = {
    type: 'repo',
    title: 'Repo',
    description: 'Short-term financing secured by collateral.',
    submitLabel: 'Submit Repo'
  };
  const fields = [
    { name: 'symbol', label: 'Symbol', type: 'text', placeholder: 'Symbol' },
    { name: 'notional_amount', label: 'Notional Amount', type: 'number', placeholder: 'Notional Amount' },
    { name: 'quantity', label: 'Quantity', type: 'number', placeholder: 'Quantity' },
    { name: 'price', label: 'Price', type: 'number', placeholder: 'Price' },
    {
      name: 'side',
      label: 'Side',
      type: 'select',
      options: [
        { value: 'buy', label: 'Buy' },
        { value: 'sell', label: 'Sell' }
      ]
    },
     { name: 'wallet_address', label: 'Whitelisted Investor Wallet', type: 'text', placeholder: '0xCP1' },
    {
      name: 'jurisdiction',
      label: 'Investor Jurisdiction',
      type: 'select',
      options: [
        { value: 'US', label: 'United States' },
        { value: 'GB', label: 'United Kingdom' }
      ]
    },
    {
      name: 'investor_type',
      label: 'Investor Type',
      type: 'select',
      options: [
        { value: 'institutional', label: 'Institutional' },
        { value: 'retail', label: 'Retail' }
      ]
    },
    {
      name: 'kyc_status',
      label: 'KYC Status',
      type: 'select',
      options: [
        { value: 'approved', label: 'Approved' },
        { value: 'pending', label: 'Pending' }
      ]
    },
    { name: 'repo_rate_bps', label: 'Repo Rate (bps)', type: 'number', placeholder: 'Repo Rate (bps)' },
    { name: 'term_days', label: 'Term (days)', type: 'number', placeholder: 'Term (days)' },
    { name: 'collateral_ref', label: 'Collateral Reference', type: 'text', placeholder: 'Collateral Reference' }
  ];
  const values = {
    symbol: '',
    notional_amount: '',
    quantity: '',
    price: '',
    side: 'buy',
    wallet_address: '',
    jurisdiction: 'US',
    investor_type: 'institutional',
    kyc_status: 'approved',
    repo_rate_bps: '',
    term_days: '',
    collateral_ref: ''
  };

  it('renders fields and triggers change and submit handlers', () => {
    const handleChange = jest.fn();
    const handleSubmit = jest.fn();
    render(
      <TradeForm
        definition={definition}
        fields={fields}
        values={values}
        errors={{}}
        onChange={handleChange}
        onSubmit={handleSubmit}
        isSubmitting={false}
      />
    );

    fireEvent.change(screen.getByLabelText(/Symbol/i), { target: { value: 'AAPL' } });
    expect(handleChange).toHaveBeenCalledWith('symbol', 'AAPL');

    fireEvent.change(screen.getByLabelText(/Repo Rate/i), { target: { value: '425' } });
    expect(handleChange).toHaveBeenCalledWith('repo_rate_bps', '425');

   fireEvent.click(screen.getByRole('button', { name: /Submit Repo/i }));
    expect(handleSubmit).toHaveBeenCalled();
  });

  it('calls onSettle when settle button clicked', () => {
    const onSettle = jest.fn();
    render(
      <TradeList
        title="Open Trades"
        trades={[
          {
            id: 1,
            trade_type: 'repo',
            notional_amount: 1000,
            symbol: 'AAPL',
            quantity: 10,
            price: 150,
            side: 'buy',
            status: 'pending'
          }
        ]}
        onSettle={onSettle}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Settle/i }));
    expect(onSettle).toHaveBeenCalledWith(1);
  });
});
