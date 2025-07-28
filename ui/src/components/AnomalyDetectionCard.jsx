import React, { useEffect, useState } from 'react';

export default function AnomalyDetectionCard({ anomalies }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function load() {
      if (anomalies) return setData(anomalies);
      const result = await new Promise(resolve =>
        setTimeout(
          () =>
            resolve([
              { id: 'L123', description: 'Payment spike', risk: 'High' },
              { id: 'L456', description: 'Low balance', risk: 'Low' }
            ]),
          300
        )
      );
      setData(result);
    }
    load();
  }, [anomalies]);

  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 relative">
      <h3 className="font-semibold text-sm mb-2">Anomaly Detection</h3>
      <div className="overflow-y-auto max-h-40 text-xs">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="pr-2 py-1">Loan ID</th>
              <th className="pr-2 py-1">Description</th>
              <th className="py-1">Risk Issue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((a, i) => (
              <tr key={i} className="border-t">
                <td className="pr-2 py-1">{a.id}</td>
                <td className="pr-2 py-1">{a.description}</td>
                <td className="py-1">
                  <span className={a.risk === 'High' ? 'text-red-600' : 'text-green-600'}>
                    {a.risk}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="absolute bottom-2 right-2 bg-purple-600 text-white text-xs rounded-full px-2 py-1">AI</button>
    </div>
  );
}
