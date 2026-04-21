import React, { useState, useEffect } from 'react'

const DEFAULT_ITEMS = [
  { id: 'profile', label: 'Complete your profile' },
  { id: 'bank', label: 'Connect a bank account' },
  { id: 'loan', label: 'Create your first loan' }
]

export default function SetupChecklist() {
  const [items, setItems] = useState(() => {
    const stored = localStorage.getItem('setupChecklist')
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {}
    }
    return DEFAULT_ITEMS.map(it => ({ ...it, done: false }))
  })

  useEffect(() => {
    localStorage.setItem('setupChecklist', JSON.stringify(items))
  }, [items])

  const toggle = id => {
    setItems(items.map(it =>
      it.id === id ? { ...it, done: !it.done } : it
    ))
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-center mb-2">Getting Started</h2>
      <ul className="space-y-1">
        {items.map(it => (
          <li key={it.id} className="flex items-center">
            <input
              id={`chk-${it.id}`}
              type="checkbox"
              className="mr-2"
              checked={it.done}
              onChange={() => toggle(it.id)}
            />
            <label htmlFor={`chk-${it.id}`} className={it.done ? 'line-through' : ''}>
              {it.label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
