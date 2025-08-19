import { supabase } from './supabaseClient'
import { API_BASE } from './apiBase'

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
}

export async function api(path, { method = 'GET', headers = {}, body, orgId } = {}) {
  const token = await getToken()
  const finalHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(orgId ? { 'X-Org-Id': orgId } : {}),
    ...headers
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok) {
    const msg = await res.text().catch(()=>`${res.status} ${res.statusText}`)
    throw new Error(msg || `${res.status} ${res.statusText}`)
  }
  return res.status === 204 ? null : res.json()
}