import React from 'react'
import EmployeeSidebar from '../components/EmployeeSidebar'

export default function EmployeeDashboard() {
  return (
    <div className="flex">
      <EmployeeSidebar />
      <main className="ml-64 p-6 bg-gray-50 min-h-screen w-full">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">Dashboard</h1>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-semibold text-gray-700 mb-2">Applications Map</h2>
            <img src="/map-placeholder.png" alt="Map" className="w-full h-40 object-cover" />
          </div>

          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-semibold text-gray-700 mb-2">Loan Origination</h2>
            <p className="text-sm text-gray-600">$3,231 / Approved</p>
            <p className="text-sm text-gray-600">864 / Declined</p>
          </div>

          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-semibold text-gray-700 mb-2">Monthly Payments</h2>
            <p className="text-sm text-gray-600">$579,240 / Collected</p>
          </div>

          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-semibold text-gray-700 mb-2">Tasks</h2>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>🔘 Review application - Today</li>
              <li>📎 Verify docs - Apr 25</li>
              <li>📊 Report to investors - Apr 26</li>
            </ul>
          </div>

          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-semibold text-gray-700 mb-2">Upcoming</h2>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>✅ Escrow setup – $122,300</li>
              <li>🔔 Payment due – $900</li>
              <li>📊 Investor report – Apr 28</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  )
}
