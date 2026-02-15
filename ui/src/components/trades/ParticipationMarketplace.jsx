import React, { useState } from 'react';
import { apiFetch } from '../../lib/apiClient'

function BidForm({ listingId, onSubmitted, onNotify }) {
  const [bidder, setBidder] = useState('');
  const [size, setSize] = useState('');
  const [rate, setRate] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
 await apiFetch(`/api/exchange-programs/participations/${listingId}/bids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bidder, size: Number(size), rate: Number(rate) })
    });
    setBidder('');
    setSize('');
    setRate('');
    onNotify?.('Bid submitted');
    onSubmitted?.();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-2 md:grid-cols-4">
      <input
        value={bidder}
        onChange={e => setBidder(e.target.value)}
        placeholder="Bidder"
        className="border p-2 rounded"
      />
      <input
        value={size}
        onChange={e => setSize(e.target.value)}
        placeholder="Size"
        className="border p-2 rounded"
      />
      <input
        value={rate}
        onChange={e => setRate(e.target.value)}
        placeholder="Rate (%)"
        className="border p-2 rounded"
      />
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        Submit Bid
      </button>
    </form>
  );
}

export default function ParticipationMarketplace({ listings = [], onRefresh, onNotify }) {
  const [loanName, setLoanName] = useState('');
  const [availableAmount, setAvailableAmount] = useState('');
  const [minPiece, setMinPiece] = useState('');
  const [targetYield, setTargetYield] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
   await apiFetch('/api/exchange-programs/participations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loan_name: loanName,
        available_amount: Number(availableAmount),
        min_piece: Number(minPiece),
        target_yield: targetYield ? Number(targetYield) : undefined,
        notes: notes || undefined
      })
    });
    setLoanName('');
    setAvailableAmount('');
    setMinPiece('');
    setTargetYield('');
    setNotes('');
    onNotify?.('Participation listed');
    onRefresh?.();
  };

  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Loan Participation Marketplace</h2>
        <p className="text-sm text-gray-600">
          List fractional participations and invite approved buyers to bid for allocations.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <input
          value={loanName}
          onChange={e => setLoanName(e.target.value)}
          placeholder="Loan Name"
          className="border p-2 rounded"
          aria-label="Loan Name"
        />
        <input
          value={availableAmount}
          onChange={e => setAvailableAmount(e.target.value)}
          placeholder="Available Amount"
          className="border p-2 rounded"
          aria-label="Available Amount"
        />
        <input
          value={minPiece}
          onChange={e => setMinPiece(e.target.value)}
          placeholder="Minimum Piece"
          className="border p-2 rounded"
          aria-label="Minimum Piece"
        />
        <input
          value={targetYield}
          onChange={e => setTargetYield(e.target.value)}
          placeholder="Target Yield (%)"
          className="border p-2 rounded"
        />
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (collateral highlights, servicing, etc.)"
          className="border p-2 rounded md:col-span-2 lg:col-span-3"
          rows={2}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded md:col-span-2 lg:col-span-3"
        >
          Publish Listing
        </button>
      </form>
      {listings.length === 0 ? (
        <p className="text-gray-500">No active participation listings.</p>
      ) : (
        <div className="space-y-4">
          {listings.map(listing => (
            <div key={listing.id} className="border rounded p-4 bg-white shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{listing.loan_name}</h3>
                  <p className="text-sm text-gray-600">
                    Available: ${Number(listing.available_amount || 0).toLocaleString()} · Min Piece:{' '}
                    ${Number(listing.min_piece || 0).toLocaleString()} · Target Yield:{' '}
                    {listing.target_yield ? `${listing.target_yield}%` : 'N/A'}
                  </p>
                  {listing.notes ? (
                    <p className="text-sm text-gray-600 mt-2">{listing.notes}</p>
                  ) : null}
                </div>
                <div className="flex-1 md:text-right">
                  <p className="text-sm font-semibold">Bids</p>
                  {listing.bids?.length ? (
                    <ul className="text-sm text-gray-700 mt-2 space-y-1">
                      {listing.bids.map(bid => (
                        <li key={bid.id}>
                          {bid.bidder} · {Number(bid.size || 0).toLocaleString()} @ {Number(bid.rate || 0)}%
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No bids yet</p>
                  )}
                </div>
              </div>
              <BidForm listingId={listing.id} onSubmitted={onRefresh} onNotify={onNotify} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
