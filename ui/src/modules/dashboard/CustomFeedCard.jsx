import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';

export default function CustomFeedCard({ url }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(url);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setData({ error: err.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <Card title="Custom Feed" loading={loading}>
      {data ? (
        <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <p className="text-sm text-gray-500">No data</p>
      )}
    </Card>
  );
}
