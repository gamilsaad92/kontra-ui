import AnomalyDetectionCard from '../components/AnomalyDetectionCard';
import PayoffAccelerationCard from '../components/PayoffAccelerationCard';

export default function AnalyticsOverview() {
   return (
    <div className="space-y-4">
      <AnomalyDetectionCard />
      <PayoffAccelerationCard />
    </div>
  );
}
