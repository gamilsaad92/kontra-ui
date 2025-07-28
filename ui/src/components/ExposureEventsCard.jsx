import React, { useEffect, useState } from 'react';

export default function ExposureEventsCard({ events }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function load() {
      if (events) return setData(events);
      const result = await new Promise(resolve =>
        setTimeout(
          () =>
            resolve([
              { summary: 'Late payment', balance: '$10,000', description: 'Loan 123' },
              { summary: 'New loan', balance: '$50,000', description: 'Loan 456' }
            ]),
          300
        )
      );
      setData(result);
    }
    load();
  }, [events]);

  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 relative">
      <h3 className="font-semibold text-sm mb-2">Exposure Events</h3>
      <div className="overflow-y-auto max-h-40 text-xs">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="pr-2 py-1">Summary</th>
              <th className="pr-2 py-1">Balance</th>
              <th className="py-1">Description</th>
            </tr>
          </thead>
          <tbody>
            {data.map((e, i) => (
              <tr key={i} className="border-t">
                <td className="pr-2 py-1">{e.summary}</td>
                <td className="pr-2 py-1">{e.balance}</td>
                <td className="py-1">{e.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-xs space-y-1">
        <p>Upcoming Payment: 09/01/24</p>
        <p>Average Risk Score: 68</p>
      </div>
      <button className="absolute bottom-2 right-2 bg-purple-600 text-white text-xs rounded-full px-2 py-1">AI</button>
    </div>
  );
}
