import React, { useMemo, useState } from 'react';
import { apiFetch } from '../../lib/apiClient'

function PoolOrderForm({ poolId, onSubmitted, onNotify }) {
  const [side, setSide] = useState('bid');
  const [price, setPrice] = useState('');
  const [size, setSize] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
  await apiFetch(`/api/exchange-programs/mini-cmbs/${poolId}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ side, price: Number(price), size: Number(size) })
    });
    setSide('bid');
    setPrice('');
    setSize('');
    onNotify?.('Order submitted');
    onSubmitted?.();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 grid gap-2 md:grid-cols-4">
      <select
        value={side}
        onChange={e => setSide(e.target.value)}
        className="border p-2 rounded"
        aria-label="Order Side"
      >
        <option value="bid">Bid</option>
        <option value="ask">Ask</option>
      </select>
      <input
        value={price}
        onChange={e => setPrice(e.target.value)}
        placeholder="Price"
        className="border p-2 rounded"
      />
      <input
        value={size}
        onChange={e => setSize(e.target.value)}
        placeholder="Size"
        className="border p-2 rounded"
      />
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        Submit Order
      </button>
    </form>
  );
}

export default function MiniCmbsPools({ pools = [], onRefresh, onNotify }) {
  const [poolName, setPoolName] = useState('');
  const [totalBalance, setTotalBalance] = useState('');
  const [couponRate, setCouponRate] = useState('');
  const [structure, setStructure] = useState('');
  const [auctionType, setAuctionType] = useState('order_book');
  const [collateral, setCollateral] = useState('');

  const clearingStats = useMemo(() => {
    if (!Array.isArray(pools)) return {};
    const openPools = pools.filter(pool => pool.status !== 'closed');
    const averageClearing =
      openPools.reduce((sum, pool) => sum + (pool.clearing_price || 0), 0) /
      (openPools.length || 1);
    return {
      openCount: openPools.length,
      averageClearing: Number.isFinite(averageClearing) ? averageClearing : null
    };
  }, [pools]);

  const handleSubmit = async e => {
    e.preventDefault();
     await apiFetch('/api/exchange-programs/mini-cmbs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pool_name: poolName,
        total_balance: Number(totalBalance),
        coupon_rate: Number(couponRate),
        structure,
        auction_type: auctionType,
        collateral: collateral
          .split('\n')
          .map(item => item.trim())
          .filter(Boolean)
      })
    });
    setPoolName('');
    setTotalBalance('');
    setCouponRate('');
    setStructure('');
    setAuctionType('order_book');
    setCollateral('');
    onNotify?.('Mini-CMBS pool created');
    onRefresh?.();
  };

  return (
    <section className="mb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold">Mini-CMBS Pools</h2>
          <p className="text-sm text-gray-600">
            Bundle transitional loans into pooled certificates and run a simple order book or
            auction for allocations.
          </p>
        </div>
        <div className="bg-slate-100 rounded px-4 py-2 text-sm text-slate-700">
          <span className="font-semibold">Open Pools:</span> {clearingStats.openCount}{' '}
          {clearingStats.averageClearing ? (
            <>
              · <span className="font-semibold">Avg. Clearing:</span>{' '}
              {clearingStats.averageClearing.toFixed(2)}
            </>
          ) : null}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <input
          value={poolName}
          onChange={e => setPoolName(e.target.value)}
          placeholder="Pool Name"
          className="border p-2 rounded"
          aria-label="Pool Name"
        />
        <input
          value={totalBalance}
          onChange={e => setTotalBalance(e.target.value)}
          placeholder="Total Balance"
          className="border p-2 rounded"
          aria-label="Total Balance"
        />
        <input
          value={couponRate}
          onChange={e => setCouponRate(e.target.value)}
          placeholder="Coupon Rate (%)"
          className="border p-2 rounded"
          aria-label="Coupon Rate"
        />
        <input
          value={structure}
          onChange={e => setStructure(e.target.value)}
          placeholder="Structure"
          className="border p-2 rounded"
        />
        <select
          value={auctionType}
          onChange={e => setAuctionType(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="order_book">Order Book</option>
          <option value="auction">Auction</option>
        </select>
        <textarea
          value={collateral}
          onChange={e => setCollateral(e.target.value)}
          placeholder="Collateral loans (one per line)"
          className="border p-2 rounded md:col-span-2 lg:col-span-3"
          rows={3}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded md:col-span-2 lg:col-span-3"
        >
          Create Pool
        </button>
      </form>
      {pools.length === 0 ? (
        <p className="text-gray-500">No Mini-CMBS pools yet.</p>
      ) : (
        <div className="space-y-4">
          {pools.map(pool => (
            <div key={pool.id} className="border rounded p-4 bg-white shadow-sm">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{pool.pool_name}</h3>
                  <p className="text-sm text-gray-600">
                    Balance: ${Number(pool.total_balance || 0).toLocaleString()} · Coupon:{' '}
                    {pool.coupon_rate}% · Structure: {pool.structure || 'N/A'} · Auction:{' '}
                    {pool.auction_type}
                  </p>
                  {pool.clearing_price ? (
                    <p className="text-sm text-emerald-600 mt-1">
                      Indicative clearing price {pool.clearing_price.toFixed(2)}
                    </p>
                  ) : null}
                  {pool.collateral?.length ? (
                    <ul className="text-sm text-gray-600 list-disc list-inside mt-2">
                      {pool.collateral.map(item => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="flex-1 md:text-right">
                  <div className="md:inline-block text-left">
                    <p className="text-sm font-semibold">Order Book</p>
                    <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                      <div>
                        <p className="font-medium text-emerald-600">Bids</p>
                        {pool.order_book?.bids?.length ? (
                          <ul className="space-y-1">
                            {pool.order_book.bids.map(order => (
                              <li key={order.id}>
                                {Number(order.size || 0).toLocaleString()} @ {Number(order.price || 0)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-500">No bids</p>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-rose-600">Asks</p>
                        {pool.order_book?.asks?.length ? (
                          <ul className="space-y-1">
                            {pool.order_book.asks.map(order => (
                              <li key={order.id}>
                                {Number(order.size || 0).toLocaleString()} @ {Number(order.price || 0)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-500">No asks</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <PoolOrderForm poolId={pool.id} onSubmitted={onRefresh} onNotify={onNotify} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
