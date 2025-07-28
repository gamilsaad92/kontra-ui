import PortfolioOverviewStats from '../components/PortfolioOverviewStats';
import ExposureEventsCard from '../components/ExposureEventsCard';
import AITrendsCard from '../components/AITrendsCard';

export default function Exposure() {
return (
    <div className="space-y-4">
      <PortfolioOverviewStats />
      <ExposureEventsCard />
      <AITrendsCard />
    </div>
  );
}
