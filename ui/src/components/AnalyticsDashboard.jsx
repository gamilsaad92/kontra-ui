import React, { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  Treemap,
} from 'recharts'
import LoanQueryWidget from './LoanQueryWidget'
import VirtualAssistant from './VirtualAssistant'

const FALLBACK_DRAWS_VOLUME = [
  { month: 'Jan', count: 22 },
  { month: 'Feb', count: 25 },
  { month: 'Mar', count: 27 },
  { month: 'Apr', count: 31 },
  { month: 'May', count: 29 },
  { month: 'Jun', count: 34 },
]

const FALLBACK_LOAN_STATUS = [
  { status: 'Current', count: 28 },
  { status: 'Late', count: 4 },
  { status: 'Watchlist', count: 2 },
  { status: 'Default', count: 1 },
]

const RECOVERY_STEPS = [
  "Check your authentication: A 401 indicates that the request was not authorized. Make sure you're logged in to your SaaS dashboard and that any API requests include a valid access token or session cookie. If your session has expired, logging out and back in should refresh the token.",
  'Verify the endpoints/paths: A 404 usually means the URL path is incorrect or the resource does not exist. Double-check that portfolio-summary, draw-requests, snapshot, and loans are valid paths on the server. If your API is versioned (e.g., /v1/loans), make sure you are targeting the correct version.',
  'Inspect request parameters: A 400 suggests that the server received a malformed request. Ensure you are passing all required parameters (e.g., loan ID, date range) and that the JSON payload or query string matches the API specification.',
  "Look for expired or missing data: The 'snapshot' and 'draw-requests' endpoints returning 404 may indicate that the data has not been generated yet (e.g., no snapshot exists for that loan) or has been deleted.",
  'Review server logs or contact support: If you control the backend, reviewing server logs around SaasDashboard-D1aah0FY.js:77:61920 can reveal what is causing the “Analytics loan query error: Object.” If it is a third-party platform, contacting their support with the error details and timestamps can help them diagnose the issue.',
]

export default function AnalyticsDashboard() {
   const [drawsData, setDrawsData] = useState(FALLBACK_DRAWS_VOLUME)
  const [loanData, setLoanData] = useState(FALLBACK_LOAN_STATUS)
  const [error, setError] = useState('')

 const delinquencyData = [
    { month: 'Jan', rate: 2.1 },
    { month: 'Feb', rate: 2.3 },
    { month: 'Mar', rate: 2.5 },
    { month: 'Apr', rate: 2.7 },
    { month: 'May', rate: 3.0 },
  ]

  const churnData = [
    { month: 'Jan', churn: 3.0 },
    { month: 'Feb', churn: 3.4 },
    { month: 'Mar', churn: 3.6 },
    { month: 'Apr', churn: 3.9 },
    { month: 'May', churn: 4.1 },
  ]

  const occupancyData = [
    { asset: 'A', forecast: 95 },
    { asset: 'B', forecast: 88 },
    { asset: 'C', forecast: 92 },
    { asset: 'D', forecast: 85 },
  ]

  const geoHeatmap = [
    { name: 'West', size: 400 },
    { name: 'East', size: 300 },
    { name: 'South', size: 200 },
    { name: 'Midwest', size: 100 },
  ]

  const riskHeatmap = [
    { name: 'Low', size: 500 },
    { name: 'Medium', size: 300 },
    { name: 'High', size: 200 },
  ]

  const loanTypeHeatmap = [
    { name: 'Bridge', size: 250 },
    { name: 'Construction', size: 150 },
    { name: 'Permanent', size: 100 },
  ]

  useEffect(() => {
     let isMounted = true

    if (!isSupabaseConfigured) {
      setError('Analytics service is not configured.')
      return () => {
        isMounted = false
      }
    }

    Promise.all([
      supabase.rpc('get_draws_volume'),
     supabase.from('loans').select('status'),
    ])
      .then(([drawsResponse, loansResponse]) => {
        if (!isMounted) return

        let encounteredError = false

        if (drawsResponse?.error) {
          encounteredError = true
          console.error('Analytics RPC error:', drawsResponse.error)
          setDrawsData(FALLBACK_DRAWS_VOLUME)
          setError((prev) => prev || 'We could not retrieve the live analytics feed.')
        } else if (Array.isArray(drawsResponse?.data) && drawsResponse.data.length > 0) {
          setDrawsData(drawsResponse.data)
        }

        if (loansResponse?.error) {
          encounteredError = true
          console.error('Analytics loan query error:', loansResponse.error)
          setLoanData(FALLBACK_LOAN_STATUS)
          setError((prev) => prev || 'We could not retrieve the live analytics feed.')
        } else if (Array.isArray(loansResponse?.data) && loansResponse.data.length > 0) {
          const countsByStatus = loansResponse.data.reduce((acc, row) => {
            const statusKey = row?.status ?? 'Unknown'
            acc[statusKey] = (acc[statusKey] || 0) + 1
            return acc
          }, {})

          const formattedLoanData = Object.entries(countsByStatus).map(([status, count]) => ({
            status,
            count,
          }))

          if (formattedLoanData.length > 0) {
            setLoanData(formattedLoanData)
          } else {
            setLoanData(FALLBACK_LOAN_STATUS)
          }
        }

           if (!encounteredError) {
          setError('')
        }
      })
          .catch((fetchError) => {
        console.error('Analytics dashboard load failed:', fetchError)
        if (!isMounted) return
        setDrawsData(FALLBACK_DRAWS_VOLUME)
        setLoanData(FALLBACK_LOAN_STATUS)
        setError('We could not retrieve the live analytics feed.')
      })

    return () => {
      isMounted = false
    }
  }, [])

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

  return (
    <div className="space-y-10">
       {error && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">{error}</p>
          <p className="mt-2">
            Use the following checks to get reconnected to your production data source:
          </p>
          <ul className="mt-3 space-y-1 list-disc pl-5">
            {RECOVERY_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <h3 className="text-xl font-bold mb-4">Monthly Draw Volume</h3>
        <BarChart width={600} height={300} data={drawsData}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" fill="#8884d8" />
        </BarChart>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Loan Portfolio by Status</h3>
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
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Legend />
          <Tooltip />
        </PieChart>
      </div>
  
      <div>
        <h3 className="text-xl font-bold mb-4">Delinquency Trends</h3>
        <LineChart width={600} height={300} data={delinquencyData}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="rate" stroke="#8884d8" />
        </LineChart>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Churn Predictions</h3>
        <LineChart width={600} height={300} data={churnData}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="churn" stroke="#82ca9d" />
        </LineChart>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Occupancy Forecasts Across Assets</h3>
        <AreaChart width={600} height={300} data={occupancyData}>
          <XAxis dataKey="asset" />
          <YAxis />
          <Tooltip />
          <Area type="monotone" dataKey="forecast" stroke="#ffc658" fill="#ffc658" />
        </AreaChart>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Portfolio Heatmaps</h3>
        <div className="flex flex-wrap gap-8">
          <div>
            <h4 className="font-semibold mb-2 text-sm">By Geography</h4>
            <Treemap
              width={200}
              height={160}
              data={geoHeatmap}
              dataKey="size"
              stroke="#fff"
              fill="#8884d8"
            />
          </div>
          <div>
            <h4 className="font-semibold mb-2 text-sm">By Risk</h4>
            <Treemap
              width={200}
              height={160}
              data={riskHeatmap}
              dataKey="size"
              stroke="#fff"
              fill="#82ca9d"
            />
          </div>
          <div>
            <h4 className="font-semibold mb-2 text-sm">By Loan Type</h4>
            <Treemap
              width={200}
              height={160}
              data={loanTypeHeatmap}
              dataKey="size"
              stroke="#fff"
              fill="#ffc658"
            />
          </div>
        </div>
      </div>
    
      <div>
        <h3 className="text-xl font-bold mb-4">BI Query</h3>
        <LoanQueryWidget />
      </div>
       <div className="border-t pt-4">
        <VirtualAssistant placeholder="Ask about analytics…" />
      </div>
    </div>
  )
}
