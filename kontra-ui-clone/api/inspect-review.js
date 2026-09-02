const express = require('express');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

function summarizeNotes(notes = '') {
  const text = typeof notes === 'string' ? notes.trim() : '';
  if (!text) {
    return 'No inspection notes supplied. Provide context so the AI reviewer can highlight issues.';
  }

  const sentences = text
    .replace(/\r?\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return 'Unable to interpret the inspection notes. Double-check the formatting and try again.';
  }

  const headline = sentences[0];
  const findings = sentences.slice(1, 4);
  if (findings.length === 0) {
    return headline;
  }

  return `${headline} Key items: ${findings.join(' ')}`;
}

function describeImages(files = []) {
  if (!Array.isArray(files) || files.length === 0) {
    return 'No photos were attached. Consider adding site photos for a richer review.';
  }

  const uniqueTypes = Array.from(new Set(files.map((file) => file.mimetype?.split('/')[1] || 'image')));
  const highlights = [];
  if (files.length > 6) {
    highlights.push('High volume of imagery captured across the site.');
  } else if (files.length >= 3) {
    highlights.push('Sufficient photo coverage to spot trends.');
  } else {
    highlights.push('Limited imagery provided—capture additional angles if possible.');
  }

  highlights.push(`File types detected: ${uniqueTypes.join(', ')}.`);
  return highlights.join(' ');
}

router.post('/', upload.any(), (req, res) => {
  try {
    const notes = req.body?.notes ?? '';
    const files = Array.isArray(req.files) ? req.files : [];

    const textSummary = summarizeNotes(notes);
    const visionSummary = describeImages(files);

    res.json({
      textSummary,
      visionSummary,
      attachments: files.length
    });
  } catch (err) {
    console.error('Inspection review error:', err);
    res.json({
      textSummary: 'Inspection review is temporarily unavailable. Try again shortly.',
      visionSummary: 'Image insights could not be generated.'
    });
  }
});

module.exports = router;
