// ui/src/components/VirtualAssistant.jsx

import React, { useState } from 'react'
import { API_BASE } from '../lib/apiBase'

export default function VirtualAssistant({
  endpoint = '/api/ask',
  placeholder = 'Ask Kontra… e.g. "Which five assets are most likely to foreclose?"',
  showVoiceControls = false
}) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [voicePrompt, setVoicePrompt] = useState('What is my payoff?')
  const [voiceResponse, setVoiceResponse] = useState('')
  const [voiceStatus, setVoiceStatus] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [callSid] = useState(() => `demo-${Math.random().toString(36).slice(2)}`)
  const [voiceLoading, setVoiceLoading] = useState(false)
  
  const sendMessage = async () => {
    if (!input.trim()) return
   const text = input.trim()
    const isCommand = text.startsWith('/')
    const userMsg = { role: 'user', content: text }
    const url = `${API_BASE}${isCommand ? '/api/chatops' : endpoint}`
    const payload = { question: isCommand ? text.slice(1) : text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

   const postVoice = async (path, params = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    })
    const text = await res.text()
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text}`)
    }
    return text
  }

  const startVoice = async () => {
    setVoiceLoading(true)
    setVoiceError('')
    try {
      const twiml = await postVoice('/api/voice', { CallSid: callSid })
      setVoiceResponse(twiml)
      setVoiceStatus('Voice webhook invoked')
    } catch (err) {
      setVoiceError(err.message)
      setVoiceStatus('Call failed')
    } finally {
      setVoiceLoading(false)
    }
  }

  const sendVoicePrompt = async () => {
    if (!voicePrompt.trim()) return
    setVoiceLoading(true)
    setVoiceError('')
    try {
      const twiml = await postVoice('/api/voice/query', {
        SpeechResult: voicePrompt.trim(),
        CallSid: callSid,
      })
      setVoiceResponse(twiml)
      setVoiceStatus('Voice prompt relayed')
    } catch (err) {
      setVoiceError(err.message)
      setVoiceStatus('Voice prompt failed')
    } finally {
      setVoiceLoading(false)
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
          placeholder={placeholder}
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
      
      {showVoiceControls && (
        <div className="border-t border-gray-200 bg-gray-50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Voice Controls (Twilio webhook)</p>
            {voiceStatus && <span className="text-xs text-green-700">{voiceStatus}</span>}
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <button
              className="bg-purple-600 text-white px-3 py-2 rounded md:w-auto"
              onClick={startVoice}
              disabled={voiceLoading}
            >
              {voiceLoading ? 'Calling…' : 'Start Voice Call'}
            </button>
            <input
              className="flex-1 border p-2 rounded"
              value={voicePrompt}
              onChange={e => setVoicePrompt(e.target.value)}
              placeholder="Say something for the bot…"
              disabled={voiceLoading}
            />
            <button
              className="bg-gray-900 text-white px-3 py-2 rounded md:w-auto"
              onClick={sendVoicePrompt}
              disabled={voiceLoading || !voicePrompt.trim()}
            >
              {voiceLoading ? 'Sending…' : 'Send Voice Prompt'}
            </button>
          </div>
          {voiceError && <p className="text-xs text-red-600">{voiceError}</p>}
          {voiceResponse && (
            <pre className="bg-white border text-xs text-gray-700 p-2 rounded max-h-40 overflow-auto">
              {voiceResponse}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
