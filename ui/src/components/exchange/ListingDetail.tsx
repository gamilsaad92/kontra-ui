import React from 'react';
import { useParams } from 'react-router-dom';
import { useOffers } from '../../lib/exchangeHooks';
import OfferPanel from './OfferPanel';
import ComplianceBanner from './ComplianceBanner';

const ListingDetail: React.FC = () => {
  const { id } = useParams();
  const { data: offers, error } = useOffers(id);

  return (
    <div className="space-y-4">
      <ComplianceBanner />
      <h2 className="text-xl font-bold">Listing {id}</h2>
      <section>
        <h3 className="font-semibold">Offers</h3>
          {error ? (
          <div className="text-red-500">{error.message}</div>
        ) : (
          <ul className="list-disc pl-6">
            {offers?.map((o: any) => (
              <li key={o.id}>{o.amount}</li>
            ))}
          </ul>
        )}
      </section>
      <OfferPanel listingId={id || ''} />
      <section>
        <h3 className="font-semibold">Messages</h3>
        {/* message thread placeholder */}
      </section>
    </div>
  );
};

export default ListingDetail;
