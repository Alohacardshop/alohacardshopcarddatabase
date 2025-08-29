import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient<Database> | null = null;

export const getSupabase = () => {
  if (!url || !anon) {
    // Do NOT create client with missing creds
    throw new Error('MISSING_SUPABASE_ENV');
  }
  if (!client) {
    client = createClient<Database>(url, anon, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      }
    });
  }
  return client;
};