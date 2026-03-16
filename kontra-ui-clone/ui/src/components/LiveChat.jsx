import React, { useEffect, useState } from 'react';

export default function LiveChat() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/chat`);
    ws.onmessage = evt => {
      try {
        const msg = JSON.parse(evt.data);
        setMessages(prev => [...prev, msg]);
      } catch (err) {
        console.error('Bad message', err);
      }
    };
    setSocket(ws);
    return () => ws.close();
  }, []);

  const send = () => {
    if (!socket || socket.readyState !== 1 || !input.trim()) return;
    socket.send(input);
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
            <span className="inline-block px-2 py-1 bg-gray-200 rounded">
              {m.content}
            </span>
          </div>
        ))}
      </div>
      <div className="p-2 flex border-t">
        <input
          className="flex-1 border p-2 rounded-l"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Chat…"
        />
        <button className="bg-blue-600 text-white px-4 rounded-r" onClick={send}
        >Send</button>
      </div>
    </div>
  );
}
