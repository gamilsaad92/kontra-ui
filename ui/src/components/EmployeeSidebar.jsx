import React from 'react'
import { FaChartBar, FaUsers, FaClipboardList, FaCogs } from 'react-icons/fa'

const menu = [
  { icon: FaChartBar, label: 'Dashboard' },
  { icon: FaClipboardList, label: 'Loans' },
  { icon: FaUsers, label: 'Applications' },
  { icon: FaCogs, label: 'Settings' }
]

export default function EmployeeSidebar() {
  return (
    <div className="fixed top-0 left-0 h-full w-64 bg-gray-800 text-white p-6 space-y-6">
      <h2 className="text-2xl font-bold">Kontra Admin</h2>
      <nav className="space-y-4">
        {menu.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-3 hover:text-blue-400 cursor-pointer">
            <Icon className="text-lg" />
            <span>{label}</span>
          </div>
        ))}
      </nav>
    </div>
  )
}
