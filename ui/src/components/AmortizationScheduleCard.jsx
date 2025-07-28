import React, { useEffect, useState } from 'react';

export default function AmortizationScheduleCard({ schedule }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function load() {
      if (schedule) return setData(schedule);
      const result = await new Promise(resolve =>
        setTimeout(
          () =>
            resolve([
              { date: '2024-08-01', payment: '$1,200', interest: '$200', balance: '$9,800' },
              { date: '2024-09-01', payment: '$1,200', interest: '$195', balance: '$8,600' }
            ]),
          300
        )
      );
      setData(result);
    }
    load();
  }, [schedule]);

  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 relative">
      <h3 className="font-semibold text-sm mb-2">Amortization Schedule</h3>
      <div className="overflow-y-auto max-h-40 text-xs">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="pr-2 py-1">Date</th>
              <th className="pr-2 py-1">Payment</th>
              <th className="pr-2 py-1">Interest</th>
              <th className="py-1">Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="pr-2 py-1">{r.date}</td>
                <td className="pr-2 py-1">{r.payment}</td>
                <td className="pr-2 py-1">{r.interest}</td>
                <td className="py-1">{r.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="absolute bottom-2 right-2 bg-purple-600 text-white text-xs rounded-full px-2 py-1">AI</button>
    </div>
  );
}
