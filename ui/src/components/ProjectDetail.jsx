import React, { useEffect, useState, useContext } from 'react'
import { supabase } from '../lib/supabaseClient'
import { AuthContext } from '../lib/authContext'
import DrawRequestsTable from './DrawRequestsTable'
import LienWaiverList from './LienWaiverList'
import ProgressGallery from './ProgressGallery'
import InvoiceMatcher from './InvoiceMatcher'

export default function ProjectDetail({ projectId }) {
  const { session } = useContext(AuthContext)
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()
      if (!error) setProject(data)
      setLoading(false)
    })()
  }, [projectId])

  if (loading) return <p>Loading project…</p>
  if (!project) return <p>Project not found.</p>

  return (
    <div>
      <h3 className="text-2xl font-bold mb-4">{project.name} (#{project.number})</h3>
      <p className="mb-2">Address: {project.address}</p>
      <p className="mb-6">Status: {project.status}</p>

      {/* Draws Under This Project */}
      <h4 className="text-xl font-semibold mb-2">Draw Requests</h4>
      <DrawRequestsTable filter={{ project_id: projectId }} />

        {/* Lien Waivers Under This Project */}
      <h4 className="text-xl font-semibold mt-8 mb-2">Lien Waivers</h4>
      <LienWaiverList filter={{ project_id: projectId }} />
      
      {/* Progress Photos */}
      <h4 className="text-xl font-semibold mt-8 mb-2">Progress Photos</h4>
      <ProgressGallery projectId={projectId} />

      {/* Invoice Matching */}
      <h4 className="text-xl font-semibold mt-8 mb-2">Invoice Matching</h4>
      <InvoiceMatcher projectId={projectId} />
    </div>
  )
}
