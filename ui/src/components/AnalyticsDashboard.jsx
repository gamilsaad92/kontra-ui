import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
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

export default function AnalyticsDashboard() {
  const [drawsData, setDrawsData] = useState([])
  const [loanData, setLoanData] = useState([])
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
    supabase
      .rpc('get_draws_volume')
      .then(({ data, error }) => {
        if (error) {
          console.error('Analytics RPC error:', error)
          setError('Failed to load analytics')
        } else {
          setDrawsData(data || [])
        }
      })

    supabase
      .from('loans')
     .select('status, count:count(*)', { group: 'status' })
      .then(({ data, error }) => {
        if (error) {
          console.error('Analytics loan query error:', error)
          setError('Failed to load analytics')
        } else {
          setLoanData(data || [])
        }
      })
  }, [])

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

  return (
    <div className="space-y-10">
      {error && <p className="text-red-600">{error}</p>}
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
