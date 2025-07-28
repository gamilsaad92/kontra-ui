import React from 'react';
import RiskSummaryCard from '../components/RiskSummaryCard';
import ExposureEventsCard from '../components/ExposureEventsCard';
import LoanMasterDetailCard from '../components/LoanMasterDetailCard';
import AnomalyDetectionCard from '../components/AnomalyDetectionCard';
import PayoffAccelerationCard from '../components/PayoffAccelerationCard';
import LoanMasterInfoCard from '../components/LoanMasterInfoCard';
import InstallmentsCard from '../components/InstallmentsCard';
import AmortizationScheduleCard from '../components/AmortizationScheduleCard';

export default function Dashboard() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <nav className="sticky top-0 z-10 bg-white border-b shadow-sm p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <select className="border rounded p-1 text-sm">
            <option>Serview</option>
          </select>
          <input
            type="text"
            placeholder="Search by natural language"
            className="border rounded p-1 text-sm w-64"
          />
        </div>
        <button className="relative px-3 py-1 bg-purple-600 text-white rounded text-sm">
          AI
          <span className="absolute -top-1 -right-1 text-[10px] bg-red-500 text-white rounded-full px-1">!</span>
        </button>
      </nav>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 flex-1">
        <RiskSummaryCard />
        <ExposureEventsCard />
        <LoanMasterDetailCard />
        <AnomalyDetectionCard />
        <PayoffAccelerationCard />
        <LoanMasterInfoCard />
        <InstallmentsCard />
        <AmortizationScheduleCard />
      </div>
    </div>
  );
}
