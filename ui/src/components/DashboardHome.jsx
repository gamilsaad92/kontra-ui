import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../main';
import { API_BASE } from '../lib/apiBase';
import Card from './Card';

export default function DashboardHome({ navigateTo }) {
  const { session } = useContext(AuthContext);
  const role = session?.user?.user_metadata?.role;

  // Report count (Finance)
  const [reportCount, setReportCount] = useState(0);
  const [loadingReports, setLoadingReports] = useState(false);
  // Loan count (Finance)
  const [loanCount, setLoanCount] = useState(0);
  const [loadingLoans, setLoadingLoans] = useState(false);
  // Occupancy percentage (Hospitality)
  const [occupancy, setOccupancy] = useState(null);
  const [loadingOccupancy, setLoadingOccupancy] = useState(false);
  // Property search state (common)
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState(null);  // null = not searched yet
  const [searchLoading, setSearchLoading] = useState(false);
  const [allAssets, setAllAssets] = useState([]);  // cache for assets
  // Real-time analytics data (common)
  const [analyticsData, setAnalyticsData] = useState(null);

  // Fetch investor reports (for Finance dashboard)
  useEffect(() => {
    if (role !== 'hospitality') {
      setLoadingReports(true);
      fetch(`${API_BASE}/api/investor-reports`)
        .then(res => res.json())
        .then(data => {
          const reports = data.reports || [];
          setReportCount(reports.length);
        })
        .catch(() => setReportCount(0))
        .finally(() => setLoadingReports(false));
    }
  }, [role]);

  // Fetch active loans (for Finance dashboard)
  useEffect(() => {
    if (role !== 'hospitality') {
      setLoadingLoans(true);
      fetch(`${API_BASE}/api/loans?status=active`)
        .then(res => res.json())
        .then(data => {
          const loans = data.loans || [];
          setLoanCount(loans.length);
        })
        .catch(() => setLoanCount(0))
        .finally(() => setLoadingLoans(false));
    }
  }, [role]);

  // Fetch occupancy data (for Hospitality dashboard)
  useEffect(() => {
    if (role === 'hospitality') {
      setLoadingOccupancy(true);
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/hospitality/metrics`);
          const data = await res.json();
          const occDaily = data.occDaily || [];
          // use latest day’s occupancy percentage
          setOccupancy(occDaily.length > 0 ? Math.round(occDaily[occDaily.length - 1].occupancy) : 0);
        } catch {
          // Fallback sample data if API fails
          const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
          const sampleOcc = days.map((d, i) => 70 + i);  // 70% -> 76%
          setOccupancy(sampleOcc[sampleOcc.length - 1]);
        } finally {
          setLoadingOccupancy(false);
        }
      })();
    }
  }, [role]);

  // Open real-time analytics stream (Market Analysis card)
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/analytics/stream`);
    es.onmessage = evt => {
      try {
        const parsed = JSON.parse(evt.data);
        setAnalyticsData(parsed);
      } catch {
        /* ignore parse errors */
      }
    };
    return () => es.close();
  }, []);

  // Handle property search form submit
  const handleSearch = async e => {
    e.preventDefault();
    if (!searchTerm) return;
    setSearchLoading(true);
    try {
      // Fetch all assets on first search
      if (allAssets.length === 0) {
        const res = await fetch(`${API_BASE}/api/assets`);
        const data = await res.json();
        const assets = data.assets || [];
        setAllAssets(assets);
        const matches = assets.filter(a =>
          (a.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
        setSearchResults(matches);
      } else {
        // Use cached assets list for subsequent searches
        const matches = allAssets.filter(a =>
          (a.name || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
        setSearchResults(matches);
      }
    } catch {
      setSearchResults([]);  // on error, treat as no results
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="grid gap-6 grid-cols-2 auto-rows-fr">
      {/* Reports card (Finance only) */}
      {role !== 'hospitality' && (
        <Card title={<span style={{ color: 'var(--brand-color)' }}>Reports</span>} loading={loadingReports}>
          <div className="text-xl">
            <span className="font-semibold text-3xl">{reportCount}</span> Reports
          </div>
        </Card>
      )}
      {/* Transactions card (Finance only) */}
      {role !== 'hospitality' && (
        <Card title={<span style={{ color: 'var(--brand-color)' }}>Transactions</span>} loading={loadingLoans}>
          <div className="text-xl">
            <span className="font-semibold text-3xl">{loanCount}</span> Active Loans
          </div>
        </Card>
      )}
      {/* Occupancy card (Hospitality only) */}
      {role === 'hospitality' && (
        <Card title={<span style={{ color: 'var(--brand-color)' }}>Occupancy</span>} loading={loadingOccupancy}>
          <div className="text-3xl font-semibold">
            {occupancy !== null ? `${occupancy}%` : 'N/A'}
          </div>
        </Card>
      )}
      {/* Property Search card (available to both roles) */}
      <div className="bg-white rounded shadow p-4 flex flex-col justify-between">
        <h3 className="font-bold mb-3" style={{ color: 'var(--brand-color)' }}>Property Search</h3>
        <form onSubmit={handleSearch} className="flex space-x-2 mb-2">
          <input 
            type="text" 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search properties..."
            className="border p-1 flex-1 rounded"
          />
          <button 
            type="submit" 
            style={{ backgroundColor: 'var(--brand-color)' }} 
            className="px-3 py-1 text-white rounded"
            disabled={searchLoading}
          >
            {searchLoading ? 'Searching...' : 'Search'}
          </button>
        </form>
        {searchResults !== null && (
          <div className="text-sm text-gray-700">
            {searchResults.length > 0 
              ? `${searchResults.length} properties found` 
              : 'No properties found'}
          </div>
        )}
      </div>
      {/* Market Analysis card (real-time analytics, spans full width if needed) */}
      {role === 'hospitality' ? (
        <div className="col-span-2">
          <Card title={<span style={{ color: 'var(--brand-color)' }}>Market Analysis</span>} loading={!analyticsData}>
            {analyticsData && (
              <div className="space-y-1 text-sm">
                <div>Total Orders: {analyticsData.totalOrders}</div>
                <div>Total Revenue: ${analyticsData.totalRevenue}</div>
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Card title={<span style={{ color: 'var(--brand-color)' }}>Market Analysis</span>} loading={!analyticsData}>
          {analyticsData && (
            <div className="space-y-1 text-sm">
              <div>Total Orders: {analyticsData.totalOrders}</div>
              <div>Total Revenue: ${analyticsData.totalRevenue}</div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
