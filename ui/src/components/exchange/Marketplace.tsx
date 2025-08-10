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
        <h1 className="text-2xl font-semibold">Loan & Portfolio Exchange</h1>
        <PreferencesDrawer />
      </header>
      <Filters />
      {isLoading ? <Spinner /> : <ListingGrid items={data} />}
    </div>
  );
}
