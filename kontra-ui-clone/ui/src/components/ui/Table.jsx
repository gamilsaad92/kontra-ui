import React from 'react';

export default function Table({ columns = [], data = [], className = '' }) {
  return (
    <table className={`min-w-full text-sm ${className}`}> 
      <thead className="bg-background text-left">
        <tr>
          {columns.map(col => (
            <th key={col.key} className="p-sm font-medium border-b">{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className="border-b last:border-b-0">
            {columns.map(col => (
              <td key={col.key} className="p-sm">{row[col.key]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
