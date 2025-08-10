import React from 'react';

export default function Spinner() {
  return (
    <div className="flex justify-center items-center p-4">
      <div className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-transparent rounded-full" />
    </div>
  );
}
