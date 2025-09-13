import React, { useEffect, useState } from "react";

interface Webhook {
  event: string;
  url: string;
}

export default function WebhooksManager() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [event, setEvent] = useState("loan.approved");
  const [url, setUrl] = useState("");
  const [topics, setTopics] = useState<string[]>([]);

  async function load() {
    try {
      const res = await fetch("/api/webhooks");
      const data = await res.json();
      setWebhooks(data.webhooks || []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    load();
    fetch("/api/webhooks/topics")
      .then((r) => r.json())
      .then((d) => setTopics(d.topics || []))
      .catch((e) => console.error(e));
  }, []);

  const add = async () => {
    if (!event || !url) return;
    await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, url }),
    });
    setUrl("");
    load();
  };

  const remove = async (e: string, u: string) => {
    await fetch("/api/webhooks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: e, url: u }),
    });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          className="border rounded p-2"
        >
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/webhook"
          className="flex-1 border rounded p-2"
        />
        <button
          onClick={add}
          className="bg-slate-800 text-white rounded px-4 py-2"
        >
          Add
        </button>
      </div>
      <table className="min-w-full bg-white border">
        <thead>
          <tr className="text-left">
            <th className="p-2 border-b">Event</th>
            <th className="p-2 border-b">URL</th>
            <th className="p-2 border-b"></th>
          </tr>
        </thead>
        <tbody>
          {webhooks.map((w) => (
            <tr key={`${w.event}-${w.url}`}>
              <td className="p-2 border-b">{w.event}</td>
              <td className="p-2 border-b">{w.url}</td>
              <td className="p-2 border-b text-right">
                <button
                  onClick={() => remove(w.event, w.url)}
                  className="text-red-600 hover:underline"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {webhooks.length === 0 && (
            <tr>
              <td colSpan={3} className="p-2 text-center text-slate-500">
                No webhooks configured
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
