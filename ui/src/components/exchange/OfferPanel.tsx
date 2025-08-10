import React, { useState } from 'react';

interface Props {
  listingId: string;
}

const OfferPanel: React.FC<Props> = ({ listingId }) => {
  const [amount, setAmount] = useState('');

  const submit = () => {
    // create/counter/accept offer
    console.log('offer', { listingId, amount });
  };

  return (
    <div className="border p-4 rounded">
      <h3 className="font-semibold">Make an Offer</h3>
      <input
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="Amount"
        className="border p-2 w-full"
      />
      <button onClick={submit} className="mt-2 px-4 py-2 bg-green-600 text-white rounded">
        Submit
      </button>
    </div>
  );
};

export default OfferPanel;
