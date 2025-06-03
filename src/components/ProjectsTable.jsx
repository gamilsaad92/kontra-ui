import React, { useEffect, useState, useContext } from 'react'
import { supabase } from '../lib/supabaseClient'
import { AuthContext } from '../main'

export default function ProjectsTable({ onSelect }) {
  const { session } = useContext(AuthContext)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('owner_id', session.user.id)
      if (!error) setProjects(data)
      setLoading(false)
    })()
  }, [session])

  if (loading) return <p>Loading projects…</p>
  if (projects.length === 0) return <p>No projects. Create one above.</p>

  return (
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
            onClick={() => onSelect(p.id)}
            className="cursor-pointer hover:bg-gray-100"
          >
            <td className="border px-4 py-2">{p.name}</td>
            <td className="border px-4 py-2">{p.number}</td>
            <td className="border px-4 py-2">{p.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
