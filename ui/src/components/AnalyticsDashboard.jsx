import React, { useEffect, useState } from "react";
import { api } from "../lib/apiClient";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import LoanQueryWidget from "./LoanQueryWidget";
import VirtualAssistant from "./VirtualAssistant";

const FALLBACK_DRAWS_VOLUME = [
  { month: "Jan", count: 22 },
  { month: "Feb", count: 25 },
  { month: "Mar", count: 27 },
  { month: "Apr", count: 31 },
  { month: "May", count: 29 },
  { month: "Jun", count: 34 },
];

const FALLBACK_LOAN_STATUS = [
  { status: "Current", count: 28 },
  { status: "Late", count: 4 },
  { status: "Watchlist", count: 2 },
  { status: "Default", count: 1 },
];

const RECOVERY_STEPS = [
  "Check your authentication: A 401 indicates that the request was not authorized. Make sure you're logged in to your SaaS dashboard and that any API requests include a valid access token or session cookie. If your session has expired, logging out and back in should refresh the token.",
  "Verify the endpoints/paths: A 404 usually means the URL path is incorrect or the resource does not exist. Double-check that portfolio-summary, draw-requests, snapshot, and loans are valid paths on the server. If your API is versioned (e.g., /v1/loans), make sure you are targeting the correct version.",
  "Inspect request parameters: A 400 suggests that the server received a malformed request. Ensure you are passing all required parameters (e.g., loan ID, date range) and that the JSON payload or query string matches the API specification.",
  "Look for expired or missing data: The 'snapshot' and 'draw-requests' endpoints returning 404 may indicate that the data has not been generated yet (e.g., no snapshot exists for that loan) or has been deleted.",
  "Review server logs or contact support: If you control the backend, reviewing server logs around SaasDashboard-D1aah0FY.js:77:61920 can reveal what is causing the “Analytics loan query error: Object.” If it is a third-party platform, contacting their support with the error details and timestamps can help them diagnose the issue.",
];

const MONTH_ORDER = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

const mapDrawsByMonth = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return FALLBACK_DRAWS_VOLUME;
  }

  const monthCounts = rows.reduce((acc, row) => {
    const submittedAt = row?.submitted_at || row?.created_at;
    if (!submittedAt) return acc;

    const month = new Date(submittedAt).toLocaleString("en-US", {
      month: "short",
    });
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});

  const formatted = Object.entries(monthCounts)
    .map(([month, count]) => ({ month, count }))
    .sort(
      (a, b) => (MONTH_ORDER[a.month] ?? 99) - (MONTH_ORDER[b.month] ?? 99),
    );

  return formatted.length > 0 ? formatted : FALLBACK_DRAWS_VOLUME;
};

const mapLoansByStatus = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return FALLBACK_LOAN_STATUS;
  }

  const countsByStatus = rows.reduce((acc, row) => {
    const statusKey = row?.status ?? "Unknown";
    acc[statusKey] = (acc[statusKey] || 0) + 1;
    return acc;
  }, {});

  const formatted = Object.entries(countsByStatus).map(([status, count]) => ({
    status,
    count,
  }));

  return formatted.length > 0 ? formatted : FALLBACK_LOAN_STATUS;
};

export default function AnalyticsDashboard() {
  const [drawsData, setDrawsData] = useState(FALLBACK_DRAWS_VOLUME);
  const [loanData, setLoanData] = useState(FALLBACK_LOAN_STATUS);
  const [error, setError] = useState("");

  const delinquencyData = [
    { month: "Jan", rate: 2.1 },
    { month: "Feb", rate: 2.3 },
    { month: "Mar", rate: 2.5 },
    { month: "Apr", rate: 2.7 },
    { month: "May", rate: 3.0 },
  ];

  const churnData = [
    { month: "Jan", churn: 3.0 },
    { month: "Feb", churn: 3.4 },
    { month: "Mar", churn: 3.6 },
    { month: "Apr", churn: 3.9 },
    { month: "May", churn: 4.1 },
  ];

  const occupancyData = [
    { asset: "A", forecast: 95 },
    { asset: "B", forecast: 88 },
    { asset: "C", forecast: 92 },
    { asset: "D", forecast: 85 },
  ];

  const geoHeatmap = [
    { name: "West", size: 400 },
    { name: "East", size: 300 },
    { name: "South", size: 200 },
    { name: "Midwest", size: 100 },
  ];

  const riskHeatmap = [
    { name: "Low", size: 500 },
    { name: "Medium", size: 300 },
    { name: "High", size: 200 },
  ];

  const loanTypeHeatmap = [
    { name: "Bridge", size: 250 },
    { name: "Construction", size: 150 },
    { name: "Permanent", size: 100 },
  ];

  useEffect(() => {
    let isMounted = true;

    const loadAnalytics = async () => {
      const [drawsResult, loansResult] = await Promise.allSettled([
        api.get("/draw-requests"),
        api.get("/loans"),
      ]);

      if (!isMounted) return;

      let requestFailed = false;

      if (drawsResult.status === "fulfilled") {
        setDrawsData(mapDrawsByMonth(drawsResult.value?.data));
      } else {
        requestFailed = true;
        console.error("Analytics draws query error:", drawsResult.reason);
        setDrawsData(FALLBACK_DRAWS_VOLUME);
      }

      if (loansResult.status === "fulfilled") {
        setLoanData(mapLoansByStatus(loansResult.value?.data));
      } else {
        requestFailed = true;
        console.error("Analytics loan query error:", loansResult.reason);
        setLoanData(FALLBACK_LOAN_STATUS);
      }

      setError(
        requestFailed ? "We could not retrieve the live analytics feed." : "",
      );
    };

    loadAnalytics().catch((fetchError) => {
      console.error("Analytics dashboard load failed:", fetchError);
      if (!isMounted) return;
      setDrawsData(FALLBACK_DRAWS_VOLUME);
      setLoanData(FALLBACK_LOAN_STATUS);
      setError("We could not retrieve the live analytics feed.");
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

  return (
    <div className="space-y-10">
      {error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">{error}</p>
          <p className="mt-2">
            Use the following checks to get reconnected to your production data
            source:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            {RECOVERY_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h3 className="mb-4 text-xl font-bold">Monthly Draw Volume</h3>
        <BarChart width={600} height={300} data={drawsData}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" fill="#8884d8" />
        </BarChart>
      </div>

      <div>
        <h3 className="mb-4 text-xl font-bold">Loan Portfolio by Status</h3>
        <PieChart width={400} height={400}>
          <Pie
            data={loanData}
            dataKey="count"
            nameKey="status"
            cx="50%"
            cy="50%"
            outerRadius={120}
            label
          >
            {loanData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Legend />
          <Tooltip />
        </PieChart>
      </div>

      <div>
        <h3 className="mb-4 text-xl font-bold">Delinquency Trends</h3>
        <LineChart width={600} height={300} data={delinquencyData}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="rate" stroke="#8884d8" />
        </LineChart>
      </div>

      <div>
        <h3 className="mb-4 text-xl font-bold">
          Customer Churn by Loan Officer
        </h3>
        <AreaChart width={600} height={300} data={churnData}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="churn"
            stroke="#82ca9d"
            fill="#82ca9d"
          />
        </AreaChart>
      </div>

      <div>
        <h3 className="mb-4 text-xl font-bold">Occupancy Forecast Heatmap</h3>
        <Treemap
          width={600}
          height={300}
          data={occupancyData}
          dataKey="forecast"
          stroke="#fff"
          fill="#8884d8"
        />
      </div>

      <div>
        <h3 className="mb-4 text-xl font-bold">
          Geographical Exposure Heatmap
        </h3>
        <Treemap
          width={600}
          height={300}
          data={geoHeatmap}
          dataKey="size"
          stroke="#fff"
          fill="#82ca9d"
        />
      </div>

      <div>
        <h3 className="mb-4 text-xl font-bold">Risk Category Heatmap</h3>
        <Treemap
          width={600}
          height={300}
          data={riskHeatmap}
          dataKey="size"
          stroke="#fff"
          fill="#ffc658"
        />
      </div>

      <div>
        <h3 className="mb-4 text-xl font-bold">Loan Type Heatmap</h3>
        <Treemap
          width={600}
          height={300}
          data={loanTypeHeatmap}
          dataKey="size"
          stroke="#fff"
          fill="#ff7300"
        />
      </div>

      <LoanQueryWidget />
      <VirtualAssistant />
    </div>
  );
}
