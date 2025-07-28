import { supabase } from '../lib/supabaseClient';

export async function fetchLoanSummary() {
  const { data, error } = await supabase
    .from('loans')
    .select('*')
    .limit(1)
    .single();

  if (error) throw error;
  return data;
}

export async function generateLoans(count = 10) {
  const res = await fetch(`/api/dev/generate-loans?count=${count}`, {
    method: 'POST'
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Failed to generate loans');
  }
  const data = await res.json();
  return data.inserted;
}
