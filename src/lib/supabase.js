import { createClient } from '@supabase/supabase-js';

// Detecta ambiente: Vite (frontend) usa import.meta.env, Node.js (bot) usa process.env
const isVite = typeof import.meta !== 'undefined' && import.meta.env;

const supabaseUrl = isVite
    ? import.meta.env.VITE_SUPABASE_URL
    : process.env.SUPABASE_URL;

const supabaseKey = isVite
    ? import.meta.env.VITE_SUPABASE_ANON_KEY
    : process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Re-export types for convenience
export * from './database.types.js';
