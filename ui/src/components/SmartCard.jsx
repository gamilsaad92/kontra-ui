import React from 'react';

export default function SmartCard({ message }) {
  return (
    <div className="border-l-4 border-blue-400 bg-blue-50 p-2 my-2 rounded">
      <p className="text-sm text-gray-700">{message}</p>
    </div>
  );
}
