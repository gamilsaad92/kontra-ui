import React from 'react';
import AssetRiskTable from './AssetRiskTable';
import WatchlistAssetsTable from './WatchlistAssetsTable';
import RevivedAssetsTable from './RevivedAssetsTable';

export default function AssetsDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Assets</h1>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Troubled Assets</h2>
        <AssetRiskTable />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Watchlist</h2>
        <WatchlistAssetsTable />
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Revived Assets</h2>
        <RevivedAssetsTable />
      </section>
    </div>
  );
}
