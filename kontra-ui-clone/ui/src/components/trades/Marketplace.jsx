import React, { useState } from 'react';
import { api } from '../../lib/apiClient';

export default function Marketplace({ entries = [], onSubmitted }) {
  const [type, setType] = useState('bid');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [settlementType, setSettlementType] = useState('p2p');
  const [stablecoin, setStablecoin] = useState('USDC');
  const [loanId, setLoanId] = useState('');
  const [loanName, setLoanName] = useState('');
  const [expectedApy, setExpectedApy] = useState('');
  const [payoutFrequency, setPayoutFrequency] = useState('monthly');
  const [walletAddress, setWalletAddress] = useState('');
  const [distributionPreview, setDistributionPreview] = useState(null);
  const [distributionAmount, setDistributionAmount] = useState('');
  const [distributionHolders, setDistributionHolders] = useState('0xabc:60,0xdef:40');
  
  const handleSubmit = async e => {
    e.preventDefault();
     await api.post('/marketplace', {
      type,
      symbol,
      quantity: Number(quantity),
      price: Number(price),
      settlementType,
      stablecoin,
      loanId: loanId || symbol,
      loanName: loanName || symbol,
      expectedApy: expectedApy === '' ? undefined : Number(expectedApy),
      payoutFrequency,
      walletAddress,
    });
    setType('bid');
    setSymbol('');
    setQuantity('');
    setPrice('');
    setSettlementType('p2p');
    setStablecoin('USDC');
    setLoanId('');
    setLoanName('');
    setExpectedApy('');
    setPayoutFrequency('monthly');
    setWalletAddress('');
    onSubmitted && onSubmitted();
  };

    const handleDistribute = async e => {
    e.preventDefault();
    const holders = distributionHolders
      .split(',')
      .map(chunk => {
        const [wallet, ownership] = chunk.split(':');
        return { wallet, ownership: Number(ownership) / 100 };
      })
      .filter(h => h.wallet && !Number.isNaN(h.ownership));

     try {
      const { data: payload } = await api.post('/marketplace/distribute', {
        loanId: loanId || symbol || 'unknown-loan',
        paymentAmount: Number(distributionAmount || 0),
        holders,
     });
      setDistributionPreview(payload);
          } catch (error) {
      console.error('Marketplace distribution failed.', error);
    }
  };

  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-2">Kontra Marketplace</h2>
      <p className="text-sm text-gray-600 mb-3">
        Tokenized loans can be listed for peer-to-peer or AMM execution. Orders settle in USDC on Base
        and include automated yield routing to investors’ wallets.
      </p>
      <form onSubmit={handleSubmit} className="space-y-2 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <select
            aria-label="Entry Type"
            value={type}
            onChange={e => setType(e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="bid">Bid</option>
            <option value="ask">Ask</option>
          </select>
          <select
            aria-label="Settlement Type"
            value={settlementType}
            onChange={e => setSettlementType(e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="p2p">Peer-to-peer</option>
            <option value="amm">AMM (liquidity pool)</option>
          </select>
          <input
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            placeholder="Symbol"
            className="border p-2 rounded w-full"
          />
          <input
            value={loanId}
            onChange={e => setLoanId(e.target.value)}
            placeholder="Loan ID"
            className="border p-2 rounded w-full"
          />
          <input
            value={loanName}
            onChange={e => setLoanName(e.target.value)}
            placeholder="Loan Name"
            className="border p-2 rounded w-full"
          />
          <input
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="Quantity (fractional units)"
            className="border p-2 rounded w-full"
          />
          <input
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="Price (USDC)"
            className="border p-2 rounded w-full"
          />
          <select
            aria-label="Stablecoin"
            value={stablecoin}
            onChange={e => setStablecoin(e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="USDC">USDC (Base)</option>
            <option value="USDC.e">USDC.e (bridged)</option>
          </select>
          <input
            value={expectedApy}
            onChange={e => setExpectedApy(e.target.value)}
            placeholder="Expected APY (%)"
            className="border p-2 rounded w-full"
          />
          <select
            aria-label="Payout Frequency"
            value={payoutFrequency}
            onChange={e => setPayoutFrequency(e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="semiannual">Semi-annual</option>
          </select>
          <input
            value={walletAddress}
            onChange={e => setWalletAddress(e.target.value)}
            placeholder="Investor Wallet (Base)"
            className="border p-2 rounded w-full md:col-span-2"
          />
        </div>
        <div className="flex flex-col md:flex-row gap-2 items-stretch">
          <div className="flex-1 bg-gray-50 border rounded p-3 text-sm text-gray-700">
            <p className="font-semibold">Stablecoin Settlement</p>
            <p>
              Orders are settled in {stablecoin} on Base. Funds route to {walletAddress || 'the investor wallet'} and
              the AMM path is used when liquidity is available.
            </p>
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded self-center h-11">
            Post Order
          </button>
        </div>
      </form>
      
      <div className="border-t pt-3 mt-4">
        <h3 className="font-semibold text-lg mb-2">Automated Yield Distribution</h3>
        <p className="text-sm text-gray-600 mb-3">
          Simulate smart contract payouts tied to borrower payments. Input the payment amount and holder split to
          preview the USDC allocation.
        </p>
        <form onSubmit={handleDistribute} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
          <input
            value={distributionAmount}
            onChange={e => setDistributionAmount(e.target.value)}
            placeholder="Payment amount (USDC)"
            className="border p-2 rounded w-full"
          />
          <input
            value={distributionHolders}
            onChange={e => setDistributionHolders(e.target.value)}
            placeholder="Holders (wallet:percent,...)"
            className="border p-2 rounded w-full"
          />
          <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded">
            Preview Distribution
          </button>
        </form>
        {distributionPreview && (
          <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-sm text-gray-800">
            <p className="font-semibold mb-1">USDC routing plan</p>
            <p className="mb-2">
              {distributionPreview.summary.paymentAmount} {distributionPreview.summary.stablecoin.token} split across
              {distributionPreview.summary.totalRecipients} wallets.
            </p>
            <ul className="space-y-1">
              {distributionPreview.distributions.map(item => (
                <li key={item.wallet} className="flex justify-between">
                  <span>{item.wallet}</span>
                  <span>{item.amount} {item.stablecoin.token}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500">No entries</p>
      ) : (
       <ul className="space-y-2 mt-4">
          {entries.map(e => (
            <li key={e.id} className="p-3 border rounded bg-gray-50">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="uppercase text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-700">{e.type}</span>
                  <span className="font-semibold">{e.loanName || e.symbol}</span>
                  <span className="text-sm text-gray-600">{e.symbol}</span>
                </div>
                <span className="text-sm text-gray-600">{e.status}</span>
              </div>
              <div className="grid md:grid-cols-3 gap-2 text-sm text-gray-700">
                <p><span className="font-semibold">Qty:</span> {e.quantity}</p>
                <p><span className="font-semibold">Price:</span> {e.price} {e.stablecoinPayment?.token || 'USDC'}</p>
                <p><span className="font-semibold">Notional:</span> {e.notionalValue}</p>
                <p><span className="font-semibold">APY:</span> {e.expectedApy ? `${(e.expectedApy * 100).toFixed(2)}%` : 'N/A'}</p>
                <p><span className="font-semibold">Settlement:</span> {e.settlementType === 'amm' ? 'AMM' : 'Peer trade'}</p>
                <p><span className="font-semibold">Payouts:</span> {e.payoutFrequency || 'monthly'}</p>
              </div>
              <p className="text-xs text-gray-500 mt-1">Automated yield sent via {e.stablecoinPayment?.token || 'USDC'} to {e.stablecoinPayment?.destination || 'configured wallet'}.</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
