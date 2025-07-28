import React, { useEffect, useState } from 'react';

export default function InstallmentsCard({ installments }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function load() {
      if (installments) return setData(installments);
      const result = await new Promise(resolve =>
        setTimeout(
          () =>
            resolve([
              { date: '2024-08-01', amount: '$1,000' },
              { date: '2024-09-01', amount: '$1,000' }
            ]),
          300
        )
      );
      setData(result);
    }
    load();
  }, [installments]);

  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 relative">
      <h3 className="font-semibold text-sm mb-2">Installments Due/Paid</h3>
      <div className="overflow-y-auto max-h-40 text-xs">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="pr-2 py-1">Due Date</th>
              <th className="py-1">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.map((i, idx) => (
              <tr key={idx} className="border-t">
                <td className="pr-2 py-1">{i.date}</td>
                <td className="py-1">{i.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="absolute bottom-2 right-2 bg-purple-600 text-white text-xs rounded-full px-2 py-1">AI</button>
    </div>
  );
}
