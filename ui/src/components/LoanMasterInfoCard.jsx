import React, { useEffect, useState } from 'react';

export default function LoanMasterInfoCard({ info }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      if (info) return setData(info);
      const result = await new Promise(resolve =>
        setTimeout(
          () =>
            resolve({
              name: 'Jane Doe',
              dob: '1990-01-01',
              ssn: '***-**-1234',
              address: '123 Main St, NY',
              phone: '555-1234',
              loanType: 'Mortgage',
              loanKind: 'Commercial',
              relationship: 'Business'
            }),
          300
        )
      );
      setData(result);
    }
    load();
  }, [info]);

  if (!data) return <div className="bg-white border rounded-lg shadow-sm p-4">Loading...</div>;

  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 relative text-xs space-y-1">
      <h3 className="font-semibold">Loan Master Info</h3>
      <p>Borrower: {data.name}</p>
      <p>DOB: {data.dob}</p>
      <p>SSN: {data.ssn}</p>
      <p>Address: {data.address}</p>
      <p>Phone: {data.phone}</p>
      <p>Loan Type: {data.loanType}</p>
      <p>Loan Kind: {data.loanKind}</p>
      <p>Relationship: {data.relationship}</p>
      <button className="absolute bottom-2 right-2 bg-purple-600 text-white text-xs rounded-full px-2 py-1">AI</button>
    </div>
  );
}
