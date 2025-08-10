import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useListings } from '../../lib/exchangeHooks';
import PreferencesDrawer from './PreferencesDrawer';
import ComplianceBanner from './ComplianceBanner';

const Marketplace: React.FC = () => {
  const { data: listings } = useListings();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [prefsOpen, setPrefsOpen] = useState(false);

  return (
    <div className="space-y-4">
      <ComplianceBanner />
      <div className="flex justify-between items-center">
        <div className="space-x-2">
          <button onClick={() => setView('grid')}>Grid</button>
          <button onClick={() => setView('list')}>List</button>
        </div>
        <div className="space-x-2">
          <button onClick={() => setPrefsOpen(true)}>Preferences</button>
          <Link to="/exchange/listings/new" className="underline">
            New Listing
          </Link>
        </div>
      </div>
      <div className={view === 'grid' ? 'grid grid-cols-3 gap-4' : 'space-y-2'}>
        {listings?.map((l: any) => (
          <Link
            key={l.id}
            to={`/exchange/listings/${l.id}`}
            className="block border p-4 rounded"
          >
            <h3 className="font-bold">{l.title}</h3>
            <p>{l.amount}</p>
          </Link>
        ))}
      </div>
      {prefsOpen && <PreferencesDrawer onClose={() => setPrefsOpen(false)} />}
    </div>
  );
};

export default Marketplace;
