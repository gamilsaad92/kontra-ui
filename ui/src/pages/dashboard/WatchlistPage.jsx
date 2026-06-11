import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const LS_KEY = "kontra_watchlist";

function loadWatchlist() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveWatchlist(items) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch {}
}

export default function WatchlistPage() {
  const [items, setItems] = useState(loadWatchlist);

  useEffect(() => { saveWatchlist(items); }, [items]);

  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Watchlist</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {items.length === 0 ? "Track assets before investing, lending, or servicing." : `${items.length} ${items.length === 1 ? "property" : "properties"} saved`}
          </p>
        </div>
        <Link to="/properties"
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          Browse Properties
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
            <div className="text-4xl mb-3">⭐</div>
            <p className="text-sm font-medium text-gray-700">Your watchlist is empty</p>
            <p className="text-xs mt-1 max-w-xs text-gray-400 leading-relaxed">
              Browse properties and click "Add to Watchlist" on any property detail page to track it here.
            </p>
            <Link to="/properties"
              className="mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "#800020" }}>
              Explore Properties
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: "📊", title: "Monitor Risk Scores", desc: "Track occupancy, compliance status, and Kontra scores for any property." },
              { icon: "🔔", title: "Get Alerts", desc: "Be notified when a watchlisted property gets a new inspection, covenant breach, or status change." },
              { icon: "🤝", title: "Connect to Providers", desc: "Reach out to inspectors, lenders, or managers directly from the watchlist." },
            ].map((item) => (
              <div key={item.title} className="bg-gray-50 rounded-xl p-4">
                <div className="text-2xl mb-2">{item.icon}</div>
                <p className="text-sm font-semibold text-gray-900 mb-1">{item.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 hover:shadow-sm transition p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg shrink-0">
                    {item.type === "Multifamily" ? "🏠" : item.type === "Industrial" ? "🏭" : item.type === "Retail" ? "🏪" : "🏢"}
                  </div>
                  <div>
                    <Link to={`/properties/${item.id}`}
                      className="font-semibold text-gray-900 hover:text-red-900 transition">
                      {item.name}
                    </Link>
                    <p className="text-xs text-gray-400">{item.market || item.location || "—"} · {item.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {item.occupancy != null && (
                    <div className="text-right hidden md:block">
                      <p className="text-sm font-semibold text-gray-900">{item.occupancy}%</p>
                      <p className="text-xs text-gray-400">Occupancy</p>
                    </div>
                  )}
                  {item.score != null && (
                    <div className="text-right hidden md:block">
                      <p className="text-sm font-semibold" style={{ color: item.riskColor || "#6b7280" }}>{item.score}/100</p>
                      <p className="text-xs text-gray-400">Score</p>
                    </div>
                  )}
                  {item.risk && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: (item.riskColor || "#6b7280") + "18", color: item.riskColor || "#6b7280" }}>
                      {item.risk}
                    </span>
                  )}
                  <button onClick={() => remove(item.id)}
                    title="Remove from watchlist"
                    className="text-yellow-400 hover:text-gray-300 transition text-xl leading-none">
                    ★
                  </button>
                </div>
              </div>
              {item.savedDate && (
                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                  <span>{item.lastUpdate ? `Latest: ${item.lastUpdate}` : ""}</span>
                  <span>Saved {item.savedDate}</span>
                </div>
              )}
            </div>
          ))}

          <Link to="/properties"
            className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-200 rounded-xl p-5 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 transition">
            + Browse more properties to watch
          </Link>
        </div>
      )}
    </div>
  );
}
