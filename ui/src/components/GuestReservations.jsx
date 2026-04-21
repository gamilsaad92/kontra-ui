import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function GuestReservations() {
  const [guestId, setGuestId] = useState('');
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/api/bookings?guest_id=${guestId}`);
      const data = await res.json();
      if (res.ok) setBookings(data.bookings || []);
      else setBookings([]);
    } catch {
      setBookings([]);
    }
  }

  async function update(id, start_date, end_date) {
    const res = await fetch(`${API_BASE}/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_date, end_date })
    });
    if (res.ok) setMessage('Updated');
    else setMessage('Update failed');
    load();
  }

  async function requestAmenity(id) {
    await fetch(`${API_BASE}/api/service-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guest_id: guestId, request: 'amenity for booking ' + id })
    });
    setMessage('Request sent');
  }

  return (
    <div className="bg-white rounded shadow p-4 space-y-4">
      <h3 className="text-xl font-semibold">My Reservations</h3>
      <div className="space-y-2">
        <input
          className="border p-2 rounded w-full"
          placeholder="Guest ID"
          value={guestId}
          onChange={e => setGuestId(e.target.value)}
        />
        <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={load}>
          Load
        </button>
      </div>
      {bookings.map(b => (
        <div key={b.id} className="border p-2 rounded space-y-1">
          <div className="flex space-x-2">
            <input
              type="date"
              className="border p-1 rounded flex-1"
              defaultValue={b.start_date}
              onBlur={e => update(b.id, e.target.value, b.end_date)}
            />
            <input
              type="date"
              className="border p-1 rounded flex-1"
              defaultValue={b.end_date}
              onBlur={e => update(b.id, b.start_date, e.target.value)}
            />
          </div>
          <button
            className="text-sm text-blue-600 underline"
            onClick={() => requestAmenity(b.id)}
          >
            Request Amenity
          </button>
        </div>
      ))}
      {message && <p className="text-green-600">{message}</p>}
    </div>
  );
}
