import React, { useEffect, useState } from 'react';
import RecentActivityTable from '../../components/RecentActivityTable';
import Card from '../../components/Card';

export default function RecentActivityCard() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  return (
        <Card title="Recent Activity" loading={loading}>
          <RecentActivityTable />
       </Card>
  );
}
