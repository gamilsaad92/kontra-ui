import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function InteractiveFAQs({ userId }) {
  const [faqs, setFaqs] = useState([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/faqs?user_id=${userId || ''}`);
        const { faqs } = await res.json();
        setFaqs(faqs || []);
      } catch {
        setFaqs([]);
      }
    })();
  }, [userId]);

  const ask = async () => {
    if (!question.trim()) return;
    setAnswer('…');
    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      const data = await res.json();
      setAnswer(data.assistant?.content || 'No answer');
    } catch {
      setAnswer('Error');
    }
  };

  return (
    <div className="bg-white rounded shadow p-4 h-full">
      <h3 className="font-bold mb-2">FAQs</h3>
      <ul className="text-sm space-y-1">
        {faqs.map((f, i) => (
          <li key={i}>
            <strong>{f.q}</strong> {f.a}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex">
        <input
          className="border p-1 flex-1"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask a question"
        />
        <button onClick={ask} className="bg-blue-600 text-white px-2">
          Ask
        </button>
      </div>
      {answer && <p className="text-sm mt-2">{answer}</p>}
    </div>
  );
}
