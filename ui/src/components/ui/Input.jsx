import React from 'react';

export default function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full border rounded p-xs focus:ring-2 focus:ring-primary ${className}`}
      {...props}
    />
  );
}
