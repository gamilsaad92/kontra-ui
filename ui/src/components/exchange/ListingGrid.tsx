import React from 'react';

interface ListingGridProps {
  items?: any[] | null;
}

export default function ListingGrid({ items = [] }: ListingGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map(item => (
        <div key={item.id} className="border p-4 rounded">
          <h3 className="font-medium">{item.title}</h3>
          <p>{item.amount}</p>
        </div>
      ))}
    </div>
  );
}
