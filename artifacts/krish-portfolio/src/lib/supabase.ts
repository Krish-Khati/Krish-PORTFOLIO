import { createClient } from '@supabase/supabase-js';

// Set these in artifacts/krish-portfolio/.env (see .env.example) and in the hosting provider.
// The anon key is meant for the browser; Row Level Security in supabase/schema.sql protects the data.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// null = not configured → the site uses its static data and the admin runs in demo mode.
// persistSession: false — the admin session lives only in memory, so closing the tab/browser
// (or reloading the page) signs the admin out and asks for email + password again next time.
export const supabase = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: false } }) : null;
