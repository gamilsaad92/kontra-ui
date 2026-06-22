import React, { useState } from "react";
import { Link } from "react-router-dom";
import PublicLayout from "./PublicLayout";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const TYPE_ICONS = {
  "Multifamily": "🏢",
  "Office": "🏛️",
  "Industrial": "🏭",
  "Retail": "🏪",
  "Mixed-Use": "🏙️",
  "Hotel / Hospitality": "🏨",
  "Self-Storage": "🗄️",
  "Land / Development": "🌍",
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export default function MyDealRoomsPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [rooms, setRooms] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLookup(e) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    setRooms(null);
    try {
      const res = await fetch(`${API_BASE}/api/public/my-rooms?email=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setRooms(data.rooms || []);
      setSubmitted(trimmed);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
            style={{ background: "#fff0f3", color: "#800020" }}>
            🏠 My Deal Rooms
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Access your deal rooms</h1>
          <p className="text-gray-500 text-base leading-relaxed">
            Enter the email address you used at checkout to see all your active deal rooms.
            No password needed.
          </p>
        </div>

        {/* Email form */}
        <form onSubmit={handleLookup} className="mb-10">
          <div className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900
                focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ "--tw-ring-color": "#800020" }}
            />
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition
                disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{ background: "#800020" }}>
              {loading ? "Looking up…" : "Find My Rooms"}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </form>

        {/* Results */}
        {rooms !== null && (
          <>
            {rooms.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
                <div className="text-4xl mb-4">📭</div>
                <h3 className="text-gray-700 font-semibold text-lg mb-2">No deal rooms found</h3>
                <p className="text-gray-400 text-sm mb-6">
                  We couldn't find any deal rooms for <strong>{submitted}</strong>.
                  Make sure you're using the same email from your Stripe receipt.
                </p>
                <Link
                  to="/create-deal-room"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition"
                  style={{ background: "#800020" }}>
                  Create a Deal Room →
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500 mb-5">
                  Found <strong>{rooms.length}</strong> deal room{rooms.length !== 1 ? "s" : ""} for{" "}
                  <strong>{submitted}</strong>
                </p>
                <div className="space-y-4">
                  {rooms.map(room => (
                    <div key={room.property_id}
                      className="border border-gray-100 rounded-2xl p-6 hover:border-gray-300
                        hover:shadow-sm transition bg-white">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1">
                            <span className="text-xl">
                              {TYPE_ICONS[room.property_type] || "🏢"}
                            </span>
                            <h3 className="font-semibold text-gray-900 text-lg truncate">
                              {room.property_name || room.property_id}
                            </h3>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              room.status === "active"
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-100 text-gray-500"
                            }`}>
                              {room.status === "active" ? "Active" : room.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                            {room.property_type && (
                              <span>{room.property_type}</span>
                            )}
                            {room.deal_amount && (
                              <span>· {room.deal_amount}</span>
                            )}
                            {room.deal_type && (
                              <span>· {room.deal_type}</span>
                            )}
                            {room.address && (
                              <span className="truncate max-w-xs">· {room.address}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-2">
                            Created {timeAgo(room.created_at)}
                            {room.activated_at && " · Paid & active"}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 shrink-0">
                          <Link
                            to={`/deal-room/${room.property_id}?role=owner`}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-white
                              hover:opacity-90 transition text-center"
                            style={{ background: "#800020" }}>
                            Open Room →
                          </Link>
                          <button
                            onClick={() => {
                              const url = `${window.location.origin}/deal-room/${room.property_id}?role=owner`;
                              navigator.clipboard?.writeText(url);
                            }}
                            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600
                              border border-gray-200 hover:bg-gray-50 transition text-center">
                            Copy Link
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    <strong>Need a new deal room?</strong> Each room is $499 and covers one property.{" "}
                    <Link to="/create-deal-room" className="underline text-gray-700 hover:text-gray-900">
                      Create another room →
                    </Link>
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state — before any lookup */}
        {rooms === null && !loading && (
          <div className="border border-dashed border-gray-200 rounded-2xl p-10 text-center">
            <div className="text-3xl mb-3">🔑</div>
            <p className="text-sm text-gray-400">
              Your deal rooms are tied to the email you used at checkout.
              No account or password required.
            </p>
          </div>
        )}

      </div>
    </PublicLayout>
  );
}
