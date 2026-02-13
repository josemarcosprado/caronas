import { createClient } from '@supabase/supabase-js';

// Detecta ambiente: Vite (frontend) usa import.meta.env, Node.js (bot) usa process.env
const isVite = typeof import.meta !== 'undefined' && import.meta.env;

const supabaseUrl = isVite
    ? import.meta.env.VITE_SUPABASE_URL
    : (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);

const supabaseKey = isVite
    ? import.meta.env.VITE_SUPABASE_ANON_KEY
    : (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

// Throw error only when trying to use the client if keys are missing
const isValidEnv = supabaseUrl && supabaseKey;

export const supabase = isValidEnv
    ? createClient(supabaseUrl, supabaseKey)
    : new Proxy({}, {
        get: () => {
            throw new Error('Supabase environment variables missing. Check .env file.');
        }
    });

// Re-export types for convenience
export * from './database.types.js';
