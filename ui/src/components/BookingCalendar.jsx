import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function BookingCalendar() {
  const [bookings, setBookings] = useState([]);
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/bookings`);
        const data = await res.json();
        setBookings(data.bookings || []);
      } catch {
        setBookings([]);
      }
      try {
        const res = await fetch(`${API_BASE}/api/room-blocks`);
        const data = await res.json();
        setBlocks(data.room_blocks || []);
      } catch {
        setBlocks([]);
      }
    })();
  }, []);

  const dates = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date();
    dt.setDate(dt.getDate() + i);
    return dt.toISOString().slice(0, 10);
  });

  function renderItems(list, date, field, label) {
    return list
      .filter(b => date >= b.start_date && date <= b.end_date)
      .map(b => (
        <div key={b.id} className="text-xs bg-blue-100 mb-1 p-1 rounded">
          {label} {b[field] || b.rooms}
        </div>
      ));
  }

  return (
    <div className="overflow-x-auto bg-white p-4 rounded shadow">
      <table className="table-auto border-collapse w-full">
        <thead>
          <tr>
            {dates.map(d => (
              <th key={d} className="border px-2 py-1 text-sm">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {dates.map(date => (
              <td key={date} className="border align-top w-1/7 px-2" style={{ verticalAlign: 'top' }}>
                {renderItems(bookings, date, 'room', 'Room')}
                {renderItems(blocks, date, 'rooms', 'Block')}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
