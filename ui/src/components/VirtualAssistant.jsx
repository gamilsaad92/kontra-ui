// ui/src/components/VirtualAssistant.jsx

import React, { useState } from 'react'
import { API_BASE } from '../lib/apiBase'

export default function VirtualAssistant() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim()) return
    const userMsg = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
  const res = await fetch(`${API_BASE}/api/ask`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ question: userMsg.content }),
   })
      

      if (!res.ok) {
        // Read the body so we know why it failed
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text}`)
      }

      const { assistant, functionResult } = await res.json()
      let content = assistant.content ?? ''
      if (assistant.function_call && functionResult) {
        content = JSON.stringify(functionResult, null, 2)
      }

      setMessages(prev => [...prev, { role: 'assistant', content }])
    } catch (err) {
      console.error('Error contacting assistant:', err)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error contacting assistant:\n${err.message}` }
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message Pane */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <span
              className={`inline-block p-2 rounded ${
                m.role === 'user'
                  ? 'bg-blue-100 text-blue-900'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              {m.content}
            </span>
          </div>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-4 flex border-t">
        <input
          className="flex-1 border p-2 rounded-l"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask Kontra..."
          disabled={loading}
        />
        <button
          className="bg-blue-600 text-white px-4 rounded-r"
          onClick={sendMessage}
          disabled={loading}
        >
          {loading ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
