import React, { useEffect, useState } from 'react';

export default function LoanMasterDetailCard({ details }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      if (details) return setData(details);
      const result = await new Promise(resolve =>
        setTimeout(
          () =>
            resolve({
              borrowers: [
                { date: '2024-07-01', note: 'Borrower added' }
              ],
              notes: [
                { date: '2024-07-02', note: 'Payment received' }
              ]
            }),
          300
        )
      );
      setData(result);
    }
    load();
  }, [details]);

  if (!data) return <div className="bg-white border rounded-lg shadow-sm p-4">Loading...</div>;

  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 relative space-y-2">
      <h3 className="font-semibold text-sm">Loan Master Detail</h3>
      <input
        type="text"
        placeholder="Search"
        className="border rounded p-1 w-full text-xs"
      />
      <div className="flex space-x-2 text-xs">
        <div className="flex-1 overflow-y-auto max-h-24">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Date</th>
                <th className="text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {data.borrowers.map((b, i) => (
                <tr key={i} className="border-t">
                  <td className="pr-2 py-1">{b.date}</td>
                  <td className="py-1">{b.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex-1 overflow-y-auto max-h-24">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Date</th>
                <th className="text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {data.notes.map((n, i) => (
                <tr key={i} className="border-t">
                  <td className="pr-2 py-1">{n.date}</td>
                  <td className="py-1">{n.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <button className="absolute bottom-2 right-2 bg-purple-600 text-white text-xs rounded-full px-2 py-1">AI</button>
    </div>
  );
}
