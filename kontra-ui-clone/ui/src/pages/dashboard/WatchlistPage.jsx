import React, { useState } from "react";
import { Link } from "react-router-dom";

const WATCHLIST = [
  { id: "harbor-view", name: "Harbor View Apartments", market: "Miami, FL", type: "Multifamily", occupancy: 97, risk: "Low", riskColor: "#16a34a", score: 93, lastUpdate: "New inspection passed", savedDate: "Jun 1, 2025" },
  { id: "palm-garden", name: "Palm Garden Villas", market: "Las Vegas, NV", type: "Multifamily", occupancy: 95, risk: "Low", riskColor: "#16a34a", score: 90, lastUpdate: "Occupancy up 2%", savedDate: "May 28, 2025" },
  { id: "meridian-tower", name: "The Meridian", market: "Dallas, TX", type: "Office", occupancy: 78, risk: "Medium", riskColor: "#d97706", score: 62, lastUpdate: "Lease rollover risk flagged", savedDate: "May 20, 2025" },
];

export default function WatchlistPage() {
  const [items, setItems] = useState(WATCHLIST);

  const remove = (id) => setItems(items.filter((i) => i.id !== id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Watchlist</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track assets before investing, lending, buying, or servicing.</p>
        </div>
        <Link to="/properties"
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          Browse Properties
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
          <div className="text-4xl mb-3">⭐</div>
          <p className="text-sm font-medium">Your watchlist is empty</p>
          <p className="text-xs mt-1 max-w-xs">Browse properties and add them to your watchlist to monitor occupancy, inspections, and compliance.</p>
          <Link to="/properties"
            className="mt-4 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "#800020" }}>
            Explore Properties
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 hover:shadow-sm transition p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg">
                    {item.type === "Multifamily" ? "🏠" : "🏢"}
                  </div>
                  <div>
                    <Link to={`/properties/${item.id}`}
                      className="font-semibold text-gray-900 hover:text-red-900 transition">
                      {item.name}
                    </Link>
                    <p className="text-xs text-gray-400">{item.market} · {item.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-semibold text-gray-900">{item.occupancy}%</p>
                    <p className="text-xs text-gray-400">Occupancy</p>
                  </div>
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-semibold" style={{ color: item.riskColor }}>{item.score}/100</p>
                    <p className="text-xs text-gray-400">Score</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: item.riskColor + "18", color: item.riskColor }}>
                    {item.risk}
                  </span>
                  <button onClick={() => remove(item.id)}
                    className="text-gray-300 hover:text-red-400 transition text-lg leading-none">★</button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                <span>Latest: {item.lastUpdate}</span>
                <span>Saved {item.savedDate}</span>
              </div>
            </div>
          ))}

          <Link to="/properties"
            className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-200 rounded-xl p-5 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 transition">
            + Add more properties to watchlist
          </Link>
        </div>
      )}
    </div>
  );
}
