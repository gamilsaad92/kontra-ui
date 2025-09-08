import React from 'react';
import LoanList from './LoanList';

export default function LoansDashboard() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Loans</h1>
      <LoanList />
    </div>
  );
}
