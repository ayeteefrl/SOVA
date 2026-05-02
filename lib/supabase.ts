import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
