import { useCallback, useEffect, useState } from 'react'
import { api } from './http'
import { useOrg } from './orgContext'

export function useList(path) {
  const { orgId } = useOrg()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (!orgId) return
    try {
      setLoading(true)
      const res = await api(path, { orgId })
      setData(res?.data || res || [])
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [orgId, path])

  useEffect(() => { reload() }, [reload])

  return { data, loading, error, reload }
}

export function useMutate(path) {
  const { orgId } = useOrg()
  const run = async (method, body) => api(path, { method, body, orgId })
  return {
    create: (body) => run('POST', body),
    update: (body) => run('PUT', body),
    remove: (body) => run('DELETE', body),
    post: (body) => run('POST', body),
    put:  (body) => run('PUT', body),
    del:  (body) => run('DELETE', body),
  }
}