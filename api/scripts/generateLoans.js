require('dotenv').config();
const { supabase } = require('../db');

['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].forEach(k => {
  if (!process.env[k]) {
    console.error(`Missing ${k}`);
    process.exit(1);
  }
});

const firstNames = ['Alice', 'Bob', 'Charlie', 'Dana', 'Evan', 'Fiona'];
const lastNames = ['Smith', 'Johnson', 'Lee', 'Garcia', 'Patel', 'Brown'];

function randomName() {
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${first} ${last}`;
}

function randomDate() {
  const now = Date.now();
  const past = now - 365 * 24 * 3600 * 1000;
  const d = new Date(past + Math.random() * (now - past));
  return d.toISOString().slice(0, 10);
}

async function generateLoans(num = 10) {
  const loans = [];
  for (let i = 0; i < num; i++) {
    loans.push({
      borrower_name: randomName(),
      amount: (Math.random() * 90000 + 10000).toFixed(2),
      interest_rate: (Math.random() * 5 + 5).toFixed(2),
      term_months: [12, 24, 36][Math.floor(Math.random() * 3)],
      start_date: randomDate()
    });
  }

  const { data, error } = await supabase.from('loans').insert(loans).select();
  if (error) {
    console.error('Failed to insert loans', error);
    throw error;
  }
  return data.length;
}

if (require.main === module) {
  const count = parseInt(process.argv[2], 10) || 10;
  generateLoans(count)
    .then(n => console.log(`Inserted ${n} loans`))
    .catch(() => process.exit(1));
}

module.exports = generateLoans;
