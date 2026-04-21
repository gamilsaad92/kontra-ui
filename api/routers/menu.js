const express = require('express');

const router = express.Router();

const menuItems = [];
let nextId = 1;

router.get('/menu', (req, res) => {
  res.json({ items: menuItems });
});

router.post('/menu', (req, res) => {
  const { name, price } = req.body || {};
  if (!name || typeof price !== 'number') {
    return res.status(400).json({ message: 'Missing name or price' });
  }
  const item = { id: nextId++, name, price };
  menuItems.push(item);
  res.status(201).json({ item });
});

router.put('/menu/:id', (req, res) => {
  const { id } = req.params;
  const item = menuItems.find(m => m.id === parseInt(id, 10));
  if (!item) return res.status(404).json({ message: 'Not found' });
  const { name, price } = req.body || {};
  if (name) item.name = name;
  if (typeof price === 'number') item.price = price;
  res.json({ item });
});

router.delete('/menu/:id', (req, res) => {
  const { id } = req.params;
  const idx = menuItems.findIndex(m => m.id === parseInt(id, 10));
  if (idx === -1) return res.status(404).json({ message: 'Not found' });
  menuItems.splice(idx, 1);
  res.json({ message: 'Deleted' });
});

module.exports = { router, menuItems };
