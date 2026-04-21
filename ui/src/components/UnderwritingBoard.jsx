import React, { useEffect, useState } from 'react'
import { API_BASE } from '../lib/apiBase'
import { supabase } from '../lib/supabaseClient'

const STATUSES = ['Underwriting', 'Approved', 'Rejected']

export default function UnderwritingBoard() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [socket, setSocket] = useState(null)
  const [users, setUsers] = useState([])

  useEffect(() => {
    let retry = 0
    let active = true
    let ws
  
    fetchTasks()
    
    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      ws = new WebSocket(`${protocol}://${window.location.host}/collab`)
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data)
          if (msg.type === 'presence') {
            setUsers(msg.users || [])
          } else if (msg.type === 'taskUpdate') {
            const task = msg.task
            setTasks((t) => t.map((x) => (x.id === task.id ? task : x)))
          }
        } catch {
          // ignore
        }
      }
        ws.onopen = () => {
        retry = 0
        const name = window.localStorage.getItem('user') || 'Anonymous'
        ws.send(JSON.stringify({ type: 'join', user: name }))
      }
      ws.onerror = () => ws.close()
      ws.onclose = () => {
        if (!active) return
        retry += 1
        const timeout = Math.min(10000, 500 * 2 ** (retry - 1))
        setTimeout(connect, timeout)
      }
      setSocket(ws)    
    }
  
    connect()
    return () => {
      active = false
      if (ws) ws.close()
    }
  }, [])

 async function fetchTasks(retries = 3, backoff = 500) {
    setLoading(true)
      for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(`${API_BASE}/api/tasks`)
        if (!res.ok) throw new Error('Failed')
        const { tasks } = await res.json()
        setTasks(tasks || [])
        setLoading(false)
        return
      } catch {
        if (i < retries - 1) {
          await new Promise((r) => setTimeout(r, backoff * 2 ** i))
        }
      }
    }
   setLoading(false)   
  }

  async function updateTask(id, status) {
        const {
      data: { session }
    } = await supabase.auth.getSession()
    const csrfToken = document
      .querySelector('meta[name="csrf-token"]')
      ?.getAttribute('content')

    await fetch(`${API_BASE}/api/tasks/${id}`, {
      method: 'PUT',
         headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {})
      },
      body: JSON.stringify({ status })
    })
     const existing = tasks.find((t) => t.id === parseInt(id)) || { id: parseInt(id) }
    const updated = { ...existing, status }
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify({ type: 'taskUpdate', task: updated }))
    }
  }

  function handleDrop(e, status) {
    const id = e.dataTransfer.getData('id')
    e.preventDefault()
    updateTask(id, status)
    setTasks((t) => t.map((task) => (task.id === parseInt(id) ? { ...task, status } : task)))
  }

  if (loading) return <p>Loading tasks…</p>

  return (
   <div>
      <div className="mb-2 text-sm text-gray-600">Active: {users.join(', ')}</div>
      <div className="flex space-x-4">
      {STATUSES.map((status) => (
        <div
          key={status}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, status)}
          className="flex-1 bg-gray-100 p-2 rounded"
        >
          <h3 className="text-lg font-bold mb-2">{status}</h3>
          {tasks
            .filter((t) => t.status === status)
            .map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('id', t.id)}
                className="bg-white p-2 mb-2 shadow rounded"
              >
                <p className="font-semibold">{t.assign}</p>
                <p className="text-sm">{t.comment}</p>
              </div>
            ))}
        </div>
      ))}
          </div>
   </div>
  )
}
