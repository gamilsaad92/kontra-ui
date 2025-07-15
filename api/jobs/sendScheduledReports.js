const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { sendEmail } = require('../communications');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const FILE = path.join(__dirname, '..', 'scheduledReports.json');

function loadJobs() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
}

function saveJobs(jobs) {
  fs.writeFileSync(FILE, JSON.stringify(jobs, null, 2));
}

async function run() {
  const jobs = loadJobs();
  const now = new Date();
  for (const job of jobs) {
    if (!job.last_sent || now - new Date(job.last_sent) >= 24*60*60*1000) {
      let q = supabase.from(job.table).select(job.fields).limit(1000);
      for (const [k,v] of Object.entries(job.filters || {})) {
        if (Array.isArray(v)) q = q.in(k, v);
        else q = q.eq(k, v);
      }
      const { data } = await q;
      const doc = new PDFDocument();
      const buffers = [];
      doc.on('data', b => buffers.push(b));
      doc.on('end', async () => {
        await sendEmail(job.email, 'Scheduled Report', 'See attached report', [
          { filename: 'report.pdf', content: Buffer.concat(buffers) }
        ]);
      });
      doc.text(JSON.stringify(data, null, 2));
      doc.end();
      job.last_sent = now.toISOString();
    }
  }
  saveJobs(jobs);
  console.log('✅ Scheduled reports sent');
}

run().then(() => process.exit()).catch(err => {
  console.error(err);
  process.exit(1);
});
