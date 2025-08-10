import React from 'react';
import { useParams } from 'react-router-dom';
import { useTrade } from '../../lib/exchangeHooks';
import ComplianceBanner from './ComplianceBanner';

const TradeRoom: React.FC = () => {
  const { id } = useParams();
  const { data: trade } = useTrade(id);

  return (
    <div className="space-y-4">
      <ComplianceBanner />
      <h2 className="text-xl font-bold">Trade Room {id}</h2>
      <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
        {JSON.stringify(trade, null, 2)}
      </pre>
      <section>
        <h3 className="font-semibold">Documents</h3>
      </section>
      <section>
        <h3 className="font-semibold">Signatures</h3>
      </section>
      <section>
        <h3 className="font-semibold">Steps</h3>
      </section>
      <section>
        <h3 className="font-semibold">Settlement</h3>
      </section>
    </div>
  );
};

export default TradeRoom;
