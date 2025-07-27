import React, { useEffect, useState } from 'react';
import AmortizationTable from './AmortizationTable';
import PaymentHistory from './PaymentHistory';
import { API_BASE } from '../lib/apiBase';
import { DetailDrawer } from './ui';
import ExtraPaymentCalculator from './ExtraPaymentCalculator';
import useRiskScore from '../hooks/useRiskScore';
import RiskIndicator from './RiskIndicator';

export default function LoanDetailPanel({ loanId, onClose }) {
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
    const { score: riskScore } = useRiskScore({
    loanId,
    borrowerHistory: {},
    paymentHistory: {},
    creditData: { creditScore: loan?.loan?.credit_score }
  });
  
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/loans/${loanId}/details`);
        const data = await res.json();
        if (res.ok) setLoan(data);
      } catch {
        setLoan(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [loanId]);

  return (
      <DetailDrawer open={!!loanId} onClose={onClose}>
      {loading && <p>Loading…</p>}
      {!loading && !loan && <p>Not found.</p>}
      {!loading && loan && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Loan #{loan.loan.id}</h3>
          <p>Borrower: {loan.loan.borrower_name}</p>
             <p>
            Status: {loan.loan.status}
            {riskScore !== null && (
              <span className="ml-2 align-middle">
                <RiskIndicator score={riskScore} />
              </span>
            )}
          </p>
          <AmortizationTable loanId={loanId} />
          <PaymentHistory loanId={loanId} />
         <ExtraPaymentCalculator loanId={loanId} />
          {loan.collateral && loan.collateral.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-4">
              <h4 className="text-lg font-medium mb-2">Collateral Docs</h4>
              <ul className="list-disc list-inside space-y-1">
                {loan.collateral.map(doc => (
                  <li key={doc.id}>
                    <a href={doc.document_url} className="text-blue-600 underline" target="_blank" rel="noreferrer">
                      {doc.document_url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </DetailDrawer>
  );
}
