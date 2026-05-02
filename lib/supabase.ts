import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

export const supabase = getSupabase();

// Type definitions for our tables
export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface BrokerSession {
  id: string;
  user_id: string;
  broker: string;
  access_token: string | null;
  enc_token: string | null;
  created_at: string;
  last_refreshed_at: string;
}
