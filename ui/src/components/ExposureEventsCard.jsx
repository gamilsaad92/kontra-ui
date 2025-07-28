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
                  { date: '2024-07-01', description: 'Late payment', impact: '-$10,000' },
              { date: '2024-07-15', description: 'New loan funded', impact: '+$50,000' }
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
                 <th className="pr-2 py-1">Event Date</th>
              <th className="pr-2 py-1">Description</th>
              <th className="py-1">Balance Impact</th>
            </tr>
          </thead>
          <tbody>
            {data.map((e, i) => (
              <tr key={i} className="border-t">
                          <td className="pr-2 py-1">{e.date}</td>
                <td className="pr-2 py-1">{e.description}</td>
                <td className="py-1">{e.impact}</td>
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
