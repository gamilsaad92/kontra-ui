import React from 'react';
import { useListings } from '../../lib/exchangeHooks';
import PreferencesDrawer from './PreferencesDrawer';
import Filters from './Filters';
import ListingGrid from './ListingGrid';
import Spinner from './Spinner';

export default function Marketplace() {
  const { data, isLoading } = useListings({ status: 'listed' });
  return (
    <div className="p-6">
      <header className="flex items-center gap-3 mb-4">
       <h1 className="text-2xl font-semibold">Fractional Asset Marketplace</h1>
        <PreferencesDrawer />
      </header>
       <p className="text-sm text-gray-600 mb-4">
        Trade tokenized asset fractions with other investors.
      </p>
      <Filters />
       {isLoading ? <Spinner /> : <ListingGrid items={data || []} />}
    </div>
  );
}
