import React, { useState } from 'react';

export default function VirtualAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(msgs => [...msgs, userMsg]);
    setInput('');
    setLoading(true);

    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ question: userMsg.content })
    });
    const { assistant, functionResult } = await res.json();

    // If functionResult, format it as content
    let content = assistant.content;
    if (assistant.function_call && functionResult) {
      content = JSON.stringify(functionResult, null, 2);
    }

    setMessages(msgs => [...msgs, { role: 'assistant', content }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {messages.map((m,i) => (
          <div key={i} className={m.role==='user' ? 'text-right':'text-left'}>
            <span className="inline-block p-2 rounded bg-gray-200">{m.content}</span>
          </div>
        ))}
      </div>
      <div className="p-4 flex">
        <input
          className="flex-1 border p-2 rounded-l"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Ask Kontra..."
        />
        <button
          className="bg-blue-600 text-white px-4 rounded-r"
          onClick={sendMessage}
          disabled={loading}
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
const suggestions = [
  { label: 'List my active projects', value: 'List my active projects' },
  { label: 'Show me high-risk projects', value: 'Calculate project risk for project 1' },
  { label: 'List draws pending approval', value: 'Fetch recent draws' },
  { label: 'What is the lien status of Project 1?', value: 'Get lien status for project 1' }
]
// … in render:
<select
  onChange={(e) => setPrompt(e.target.value)}
  className="border p-2 rounded"
>
  <option value="">— Suggested Questions —</option>
  {suggestions.map((s) => (
    <option key={s.value} value={s.value}>{s.label}</option>
  ))}
</select>
