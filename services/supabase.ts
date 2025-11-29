import { createClient } from '@supabase/supabase-js';

// NOTE: In a real environment, these would be process.env.VITE_SUPABASE_URL
// For this demo to "run" without crashing, we check if they exist. 
// If not, the DB service will throw connection errors, which we handle in the UI.

const env = (import.meta as any).env;

const supabaseUrl = env?.VITE_SUPABASE_URL || 'https://xyz.supabase.co';
const supabaseKey = env?.VITE_SUPABASE_ANON_KEY || 'public-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);