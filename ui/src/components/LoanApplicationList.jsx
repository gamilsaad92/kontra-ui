/ src/components/LoanApplicationList.jsx

import React, { useEffect, useState } from 'react'
import { API_BASE } from '../lib/apiBase'

export default function LoanApplicationList() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/loan-applications`)
        const { applications } = await res.json()
        setApplications(applications || [])
      } catch {
        // ignore errors
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <p>Loading applications…</p>
  if (applications.length === 0) return <p>No applications found.</p>

  return (
    <div className="bg-white rounded-lg shadow-md">
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">ID</th>
            <th className="p-2">Name</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Credit</th>
            <th className="p-2">KYC</th>
            <th className="p-2">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50">
              <td className="p-2">{a.id}</td>
              <td className="p-2">{a.name}</td>
              <td className="p-2">{a.amount}</td>
              <td className="p-2">{a.credit_score}</td>
              <td className="p-2">{a.kyc_passed ? '✅' : '❌'}</td>
              <td className="p-2">
                {new Date(a.submitted_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
