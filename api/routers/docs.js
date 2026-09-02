const express = require('express');
  const multer  = require('multer');
  const { createClient } = require('@supabase/supabase-js');

  const router = express.Router();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const BUCKET = 'loan-documents';

  // Ensure bucket + documents table exist on first load
  async function bootstrap() {
    // Bucket
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.find(b => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 52428800 });
    }
    // Table (idempotent)
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS documents (
          id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          loan_id      UUID,
          org_id       UUID,
          doc_type     TEXT NOT NULL DEFAULT 'other',
          filename     TEXT NOT NULL,
          storage_path TEXT NOT NULL,
          size_bytes   BIGINT,
          mime_type    TEXT,
          uploaded_by  UUID,
          created_at   TIMESTAMPTZ DEFAULT now()
        );
      `
    }).catch(() => null); // rpc may not exist — swallow and let first insert reveal issue
  }
  bootstrap().catch(err => console.warn('[docs] bootstrap warn:', err.message));

  // ── POST /api/docs/upload ───────────────────────────────────────────────────
  router.post('/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file provided' });

      const { loan_id, doc_type = 'other', org_id, uploaded_by } = req.body;
      const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = [org_id || 'global', loan_id || 'unassigned', `${Date.now()}_${safeName}`].join('/');

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
      if (upErr) return res.status(500).json({ error: upErr.message });

      const { data, error: dbErr } = await supabase.from('documents').insert({
        loan_id:      loan_id      || null,
        org_id:       org_id       || null,
        doc_type,
        filename:     req.file.originalname,
        storage_path: storagePath,
        size_bytes:   req.file.size,
        mime_type:    req.file.mimetype,
        uploaded_by:  uploaded_by  || null,
      }).select().single();

      if (dbErr) {
        // Clean up orphaned storage object
        await supabase.storage.from(BUCKET).remove([storagePath]);
        return res.status(500).json({ error: dbErr.message });
      }

      res.status(201).json(data);
    } catch (err) {
      console.error('[docs] upload error:', err);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // ── GET /api/docs ───────────────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    try {
      const { loan_id, org_id, doc_type, limit = 100 } = req.query;
      let q = supabase.from('documents').select('*').order('created_at', { ascending: false }).limit(Number(limit));
      if (loan_id)  q = q.eq('loan_id', loan_id);
      if (org_id)   q = q.eq('org_id', org_id);
      if (doc_type) q = q.eq('doc_type', doc_type);

      const { data, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      res.json(data ?? []);
    } catch (err) {
      console.error('[docs] list error:', err);
      res.status(500).json({ error: 'Failed to list documents' });
    }
  });

  // ── GET /api/docs/:id/download ──────────────────────────────────────────────
  router.get('/:id/download', async (req, res) => {
    try {
      const { data: doc, error } = await supabase
        .from('documents').select('*').eq('id', req.params.id).single();
      if (error || !doc) return res.status(404).json({ error: 'Document not found' });

      const { data: signed, error: urlErr } = await supabase.storage
        .from(BUCKET).createSignedUrl(doc.storage_path, 3600);
      if (urlErr) return res.status(500).json({ error: urlErr.message });

      res.json({ url: signed.signedUrl, filename: doc.filename, mime_type: doc.mime_type });
    } catch (err) {
      console.error('[docs] download error:', err);
      res.status(500).json({ error: 'Failed to generate download link' });
    }
  });

  // ── DELETE /api/docs/:id ────────────────────────────────────────────────────
  router.delete('/:id', async (req, res) => {
    try {
      const { data: doc, error } = await supabase
        .from('documents').select('*').eq('id', req.params.id).single();
      if (error || !doc) return res.status(404).json({ error: 'Document not found' });

      const [, { error: dbErr }] = await Promise.all([
        supabase.storage.from(BUCKET).remove([doc.storage_path]),
        supabase.from('documents').delete().eq('id', req.params.id),
      ]);
      if (dbErr) return res.status(500).json({ error: dbErr.message });

      res.json({ success: true, id: doc.id });
    } catch (err) {
      console.error('[docs] delete error:', err);
      res.status(500).json({ error: 'Delete failed' });
    }
  });

  module.exports = router;
  