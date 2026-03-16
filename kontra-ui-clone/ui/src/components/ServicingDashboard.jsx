import React from 'react';
import PaymentPortal from './PaymentPortal';
import DelinquencyAlertForm from './DelinquencyAlertForm';
import EscrowDisbursementTracker from './EscrowDisbursementTracker';
import BorrowerCommunicationsLog from './BorrowerCommunicationsLog';
import DistributionPlanner from './DistributionPlanner';

export default function ServicingDashboard() {
  return (
    <div className="space-y-6">
           <DistributionPlanner />
      <div className="grid md:grid-cols-2 gap-6">
        <PaymentPortal />
        <DelinquencyAlertForm />
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <EscrowDisbursementTracker />
        <BorrowerCommunicationsLog />
      </div>
    </div>
  );
}
