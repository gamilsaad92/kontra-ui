import React, { useEffect, useState, useContext } from 'react'
import { AuthContext } from '../lib/authContext'
import { API_BASE } from '../lib/apiBase'
import ProjectDetailDrawer from './ProjectDetailDrawer'
  
export default function ProjectsTable({ onSelect }) {
  const { session } = useContext(AuthContext)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '' })
  const [detailId, setDetailId] = useState(null)
    
  useEffect(() => {
    (async () => {
      setLoading(true)
        if (!session) {
        setLoading(false)
        return
      }
      const params = new URLSearchParams()
      params.append('owner_id', session.user.id)
      if (filters.status) params.append('status', filters.status)
      const res = await fetch(`${API_BASE}/api/projects?${params.toString()}`)
      const { projects } = await res.json()
      setProjects(projects || [])
      setLoading(false)
    })()
   }, [session, filters])

  const exportCsv = async () => {
        if (!session) {
      alert('Please log in to export projects')
      return
    }
    const params = new URLSearchParams()
    params.append('owner_id', session.user.id)
    if (filters.status) params.append('status', filters.status)
    const res = await fetch(`${API_BASE}/api/projects/export?${params.toString()}`)
    const csv = await res.text()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'projects.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!session) return <p>Please log in to view projects.</p>
  if (loading) return <p>Loading projects…</p>
  if (projects.length === 0) return <p>No projects. Create one above.</p>

  return (
       <div className="space-y-4">
      <div className="flex space-x-2">
        <select
          className="border p-1"
          value={filters.status}
          onChange={e => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Any Status</option>
          <option value="active">active</option>
          <option value="completed">completed</option>
        </select>
        <button
          onClick={exportCsv}
          className="px-2 py-1 bg-green-600 text-white rounded"
        >
          Export CSV
        </button>
      </div>
      <table className="w-full table-auto">
        <thead>
          <tr className="bg-gray-200">
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Number</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr
              key={p.id}
              onClick={() => { setDetailId(p.id); onSelect && onSelect(p.id); }}
              className="cursor-pointer hover:bg-gray-100"
            >
              <td className="border px-4 py-2">{p.name}</td>
              <td className="border px-4 py-2">{p.number}</td>
              <td className="border px-4 py-2">{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {detailId && (
        <ProjectDetailDrawer projectId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  )
}
