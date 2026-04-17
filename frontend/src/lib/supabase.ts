import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Create a dummy client for build time when env vars aren't available.
// At runtime in the browser, the real env vars will be embedded by Next.js.
function createSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a placeholder that won't throw during SSG/SSR build
    return createClient(
      "https://placeholder.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder"
    );
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

export const supabase = createSupabaseClient();
