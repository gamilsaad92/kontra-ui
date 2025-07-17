import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function RestaurantMenu() {
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/menu`).then(res => res.json()).then(d => {
      setMenu(d.items || []);
    });
  }, []);

  const add = id => {
    setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  };

  const submit = async () => {
    const items = Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId: parseInt(menuItemId, 10), quantity }));
    if (!items.length) return;
    const res = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, table: 'online' })
    });
    if (res.ok) {
      setMessage('Order placed');
      setCart({});
    } else {
      setMessage('Failed to place order');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">Menu</h3>
      <ul className="space-y-2">
        {menu.map(item => (
          <li key={item.id} className="flex justify-between border p-2 rounded">
            <span>{item.name} - ${item.price}</span>
            <button className="bg-blue-600 text-white px-2 rounded" onClick={() => add(item.id)}>Add</button>
          </li>
        ))}
      </ul>
      <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={submit}>Submit Order</button>
      {message && <p>{message}</p>}
    </div>
  );
}
