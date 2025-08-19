import { createContext, useContext, useEffect, useState } from 'react'

export const OrgContext = createContext({ orgId: null, setOrgId: () => {} })

export function OrgProvider({ children }) {
  const [orgId, setOrgId] = useState(() => localStorage.getItem('orgId') || '')

  useEffect(() => {
    if (orgId) localStorage.setItem('orgId', orgId)
  }, [orgId])

  return (
    <OrgContext.Provider value={{ orgId, setOrgId }}>
      {children}
    </OrgContext.Provider>
  )
}

export const useOrg = () => useContext(OrgContext)