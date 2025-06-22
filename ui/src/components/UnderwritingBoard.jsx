import React, { useEffect, useState } from 'react'
import { API_BASE } from '../lib/apiBase'

const STATUSES = ['Underwriting', 'Approved', 'Rejected']

export default function UnderwritingBoard() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTasks()
  }, [])

  async function fetchTasks() {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/tasks`)
      const { tasks } = await res.json()
      setTasks(tasks || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function updateTask(id, status) {
    await fetch(`${API_BASE}/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
  }

  function handleDrop(e, status) {
    const id = e.dataTransfer.getData('id')
    e.preventDefault()
    updateTask(id, status)
    setTasks((t) => t.map((task) => (task.id === parseInt(id) ? { ...task, status } : task)))
  }

  if (loading) return <p>Loading tasks…</p>

  return (
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
  )
}
