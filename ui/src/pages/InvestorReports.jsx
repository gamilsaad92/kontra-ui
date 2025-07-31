import React, { useState } from 'react';
import InvestorReportForm from '../components/InvestorReportForm.jsx';
import InvestorReportsList from '../components/InvestorReportsList.jsx';

export default function InvestorReports() {
  const [refresh, setRefresh] = useState(0);
  return (
    <>
      <InvestorReportForm onCreated={() => setRefresh(k => k + 1)} />
      <InvestorReportsList refresh={refresh} />
    </>
  );
}
