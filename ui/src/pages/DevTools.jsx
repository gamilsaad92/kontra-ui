import React from 'react';
import { Link } from 'react-router-dom';

export default function DevTools() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Developer Tools</h1>
      <Link to="/generate-loans" className="text-blue-600 underline">Generate Loans</Link>
    </div>
  );
}
