import PaymentPortal from '../components/PaymentPortal';
import SelfServicePayment from '../components/SelfServicePayment';
import EscrowDashboard from '../components/EscrowDashboard';
import CollectionsTable from '../components/CollectionsTable';

export default function Servicing() {
 return (
    <div className="space-y-4">
      <PaymentPortal />
      <SelfServicePayment />
      <EscrowDashboard />
      <CollectionsTable />
    </div>
  );
}
