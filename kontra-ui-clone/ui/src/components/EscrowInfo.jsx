import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

function nextInsuranceDue(startDate) {
  const start = new Date(startDate);
  const now = new Date();
  const due = new Date(now.getFullYear(), start.getMonth(), start.getDate());
  if (due < now) due.setFullYear(due.getFullYear() + 1);
  return due.toISOString().slice(0, 10);
}

function nextTaxDue(startDate) {
  const start = new Date(startDate);
  const now = new Date();
  const due = new Date(now.getFullYear(), 11, start.getDate());
  if (due < now) due.setFullYear(due.getFullYear() + 1);
  return due.toISOString().slice(0, 10);
}

export default function EscrowInfo({ loanId, startDate }) {
  const [escrow, setEscrow] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/loans/${loanId}/escrow`);
        const data = await res.json();
        if (data.escrow) {
          setEscrow({
            ...data.escrow,
            next_tax_due: nextTaxDue(startDate),
            next_insurance_due: nextInsuranceDue(startDate)
          });
        }
      } catch {
        setEscrow(null);
      }
    })();
  }, [loanId, startDate]);

  if (!escrow) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h4 className="text-lg font-medium mb-2">Escrow</h4>
      <p>Balance: {escrow.escrow_balance}</p>
      <p>Tax Amount: {escrow.tax_amount} (next due {escrow.next_tax_due})</p>
      <p>Insurance Amount: {escrow.insurance_amount} (next due {escrow.next_insurance_due})</p>
    </div>
  );
}
