import React from 'react';
import AssetRiskTable from '../modules/assets/AssetRiskTable.jsx';
import RevivedAssetsTable from '../modules/assets/RevivedAssetsTable.jsx';

export default function RiskMonitoring() {
  return (
    <div className="space-y-4">
      <AssetRiskTable />
      <RevivedAssetsTable />
    </div>
  );
}
