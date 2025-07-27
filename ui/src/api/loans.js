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
