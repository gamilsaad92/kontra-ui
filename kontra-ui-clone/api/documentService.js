const { supabase } = require('./db');

const EXCHANGE_BUCKET = 'exchange';
const TEMPLATE_PATH = 'templates';

const TEMPLATE_NAMES = [
  'Participation Agreement',
  'Assignment Agreement',
  'Repo Master',
  'Trade Confirm',
  'Settlement Instructions'
];

async function mergeTemplate(templateName, placeholders = {}) {
  const path = `${TEMPLATE_PATH}/${templateName}.txt`;
  const { data, error } = await supabase.storage
    .from(EXCHANGE_BUCKET)
    .download(path);
  if (error) throw new Error(`Template download failed: ${error.message}`);
  let content = await data.text();
  for (const [key, value] of Object.entries(placeholders)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    content = content.replace(regex, value);
  }
  return Buffer.from(content, 'utf8');
}

async function signPath(path) {
  const { data, error } = await supabase.storage
    .from(EXCHANGE_BUCKET)
    .createSignedUrl(path, 60);
  if (error) throw new Error(`Sign URL failed: ${error.message}`);
  return data.signedUrl;
}

async function generateAndStore(tradeId, templateName, placeholders = {}) {
  const buffer = await mergeTemplate(templateName, placeholders);
  const filePath = `trades/${tradeId}/${templateName}.txt`;
  const { error } = await supabase.storage
    .from(EXCHANGE_BUCKET)
    .upload(filePath, buffer, { upsert: true, contentType: 'text/plain' });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const url = await signPath(filePath);
  return { path: filePath, url };
}

async function sendForSignature(tradeId, filePath) {
  const fileName = filePath.split('/').pop();
  const signedPath = `trades/${tradeId}/signed/${fileName}`;
  const { error: copyError } = await supabase.storage
    .from(EXCHANGE_BUCKET)
    .copy(filePath, signedPath);
  if (copyError) throw new Error(`Signature storage failed: ${copyError.message}`);
  const url = await signPath(signedPath);
  return { path: signedPath, url };
}

async function storeSigned(tradeId, fileName, buffer) {
  const path = `trades/${tradeId}/signed/${fileName}`;
  const { error } = await supabase.storage
    .from(EXCHANGE_BUCKET)
    .upload(path, buffer, { upsert: true });
  if (error) throw new Error(`Signed upload failed: ${error.message}`);
  const url = await signPath(path);
  return { path, url };
}

module.exports = {
  TEMPLATE_NAMES,
  mergeTemplate,
  generateAndStore,
  sendForSignature,
  storeSigned,
  signPath
};
