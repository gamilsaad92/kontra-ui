import React, { useEffect, useState } from 'react'
import { useOrg } from '../lib/orgContext'
import { api } from '../lib/http'

export default function OrgSelect() {
  const { orgId, setOrgId } = useOrg()
  const [orgs, setOrgs] = useState([])

  useEffect(() => {
    (async () => {
      try {
        const res = await api('/api/organizations/list')
        const list = res?.data || res || []
        setOrgs(list)
        if (!orgId && list[0]?.id) setOrgId(list[0].id)
      } catch (e) {
        console.warn('Failed to load orgs', e.message)
      }
    })()
  }, [])

  return (
    <select
      value={orgId || ''}
      onChange={e => setOrgId(e.target.value)}
      className="m-2 p-1 bg-gray-700 text-white rounded w-[calc(100%-1rem)]"
      aria-label="Organization"
    >
      <option value="" disabled>Select organization</option>
      {orgs.map(o => (
        <option key={o.id || o.slug} value={o.id || o.slug}>
          {o.name || o.slug || o.id}
        </option>
      ))}
    </select>
  )
}