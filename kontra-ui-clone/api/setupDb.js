const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Missing DATABASE_URL environment variable');
  process.exit(1);
}

const schemaFiles = fs
  .readdirSync(__dirname)
  .filter(f => f.startsWith('schema-') && f.endsWith('.sql'))
  .sort();

for (const file of schemaFiles) {
  const fullPath = path.join(__dirname, file);
  console.log(`Applying ${file}`);
  execSync(`psql "${dbUrl}" -f "${fullPath}"`, { stdio: 'inherit' });
}
