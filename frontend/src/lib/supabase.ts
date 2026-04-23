import { createClient, SupabaseClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
function create(): SupabaseClient { if (!url || !key) return createClient("https://placeholder.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder"); return createClient(url, key); }
export const supabase = create();
