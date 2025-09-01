import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } from 'recharts'
import LoanQueryWidget from './LoanQueryWidget'
import VirtualAssistant from './VirtualAssistant'

export default function AnalyticsDashboard() {
  const [drawsData, setDrawsData] = useState([])
  const [loanData, setLoanData] = useState([])
  const [error, setError] = useState('')

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
        <h3 className="text-xl font-bold mb-4">BI Query</h3>
        <LoanQueryWidget />
      </div>
           <div className="border-t pt-4">
        <VirtualAssistant placeholder="Ask about analytics…" />
      </div>
    </div>
  )
}
