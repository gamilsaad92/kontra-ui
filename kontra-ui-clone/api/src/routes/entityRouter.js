const express = require('express');
const { z } = require('zod');
const { listEntity, createEntity, getEntity, updateEntity } = require('../lib/crud');
const { entitySchema, listQuerySchema, createEntitySchema, patchEntitySchema, listResponseSchema } = require('../schemas/entities');

function parse(schema, payload, res) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    res.status(400).json({ message: 'Validation failed', issues: result.error.issues });
    return null;
  }
  return result.data;
}

function createEntityRouter(path, table) {
  const router = express.Router();
  const run = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  router.get(path, run(async (req, res) => {
    const query = parse(listQuerySchema, req.query, res);
    if (!query) return;
    let data;
    try {
      data = await listEntity(table, req.orgId, query);
    } catch (error) {
      if (error && (error.code === 'SCHEMA_MISSING' || error.code === 'DB_ERROR')) {
        data = { items: [], total: 0 };
      } else {
        throw error;
      }
    }
    const validated = parse(listResponseSchema, data, res);
    if (!validated) return;
    res.json(validated);
  }));

  router.post(path, run(async (req, res) => {
    const payload = parse(createEntitySchema, req.body, res);
    if (!payload) return;
    const created = await createEntity(table, req.orgId, {
      status: payload.status || 'active',
      title: payload.title,
      data: payload.data,
    });
    const validated = parse(entitySchema, created, res);
    if (!validated) return;
    res.status(201).json(validated);
  }));

  router.get(`${path}/:id`, run(async (req, res) => {
    const id = parse(z.string().uuid(), req.params.id, res);
    if (!id) return;
    const item = await getEntity(table, req.orgId, id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    const validated = parse(entitySchema, item, res);
    if (!validated) return;
    res.json(validated);
  }));

  router.patch(`${path}/:id`, run(async (req, res) => {
    const id = parse(z.string().uuid(), req.params.id, res);
    if (!id) return;
    const payload = parse(patchEntitySchema, req.body, res);
    if (!payload) return;
    const updated = await updateEntity(table, req.orgId, id, payload);
    if (!updated) return res.status(404).json({ message: 'Not found' });
    const validated = parse(entitySchema, updated, res);
    if (!validated) return;
    res.json(validated);
  }));

  return router;
}

module.exports = { createEntityRouter };
