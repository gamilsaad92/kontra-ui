export function Table({ columns, data }) {
  return (
    <table className="min-w-full bg-surface rounded-2xl overflow-hidden shadow">
      <thead className="bg-gray-100 text-left">
        <tr>
          {columns.map(col => (
            <th key={col.accessor} className="px-4 py-2 text-sm text-text-secondary">
              {col.Header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className="border-b last:border-0">
            {columns.map(col => (
              <td key={col.accessor} className="px-4 py-3 text-text-primary text-base">
                {row[col.accessor]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export default Table;
