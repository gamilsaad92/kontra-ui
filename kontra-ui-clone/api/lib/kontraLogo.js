'use strict';

const fs = require('fs');
const path = require('path');

const candidatePaths = [
  path.join(__dirname, '../../ui/Public/kontra-platform-logo.png'),
  path.join(process.cwd(), 'ui/Public/kontra-platform-logo.png'),
  path.join(process.cwd(), '../ui/Public/kontra-platform-logo.png'),
];
const logoPath = candidatePaths.find(candidate => fs.existsSync(candidate));

if (!logoPath) {
  throw new Error('The official Kontra logo asset is required to render preparation PDFs.');
}

module.exports = fs.readFileSync(logoPath);