const express = require('express');

const integrations = {
  quickbooks: false,
  yardi: false,
  procore: false,
  toast: false,
  square: false,
  xero: false
};

const router = express.Router();

router.get('/integrations', (req, res) => {
  res.json({ integrations });
});

router.post('/integrations/:name/connect', (req, res) => {
  const { name } = req.params;
  if (!Object.prototype.hasOwnProperty.call(integrations, name)) {
    return res.status(400).json({ message: 'Unknown integration' });
  }
  integrations[name] = true;
  res.json({ message: `${name} connected` });
});

module.exports = { router, integrations };
