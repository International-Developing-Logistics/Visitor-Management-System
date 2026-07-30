import { createClient } from "@supabase/supabase-js";

// Browser client — safe to use in client components (uses the public anon key).
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Server-only client — uses the service role key, which bypasses row-level
// security. Only ever import this inside app/api/** route handlers, never
// in a client component, or you'll leak the key to the browser.
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
