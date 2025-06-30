import React, { useEffect, useState } from 'react';
import GridLayout from 'react-grid-layout';
import { API_BASE } from '../lib/apiBase';
import RiskScoreCard from '../modules/dashboard/RiskScoreCard';
import DelinquencyCard from '../modules/dashboard/DelinquencyCard';
import RecentActivityCard from '../modules/dashboard/RecentActivityCard';

export default function DashboardPage() {
  const [layout, setLayout] = useState([]);
  useEffect(() => {
    fetch(`${API_BASE}/api/dashboard-layout?key=home`)
      .then(r => r.json())
      .then(d => setLayout(d.layout));
  }, []);

  const onLayoutChange = newLayout => {
    setLayout(newLayout);
    fetch(`${API_BASE}/api/dashboard-layout`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({key:'home', layout:newLayout})
    });
  };

  return (
    <GridLayout
      className="layout"
      layout={layout}
      cols={12}
      rowHeight={30}
      width={1200}
      onLayoutChange={onLayoutChange}
    >
      <div key="riskScore"><RiskScoreCard /></div>
      <div key="delinquencyChart"><DelinquencyCard /></div>
      <div key="recentActivity"><RecentActivityCard /></div>
      {/* add more cards as you go */}
    </GridLayout>
  );
}
