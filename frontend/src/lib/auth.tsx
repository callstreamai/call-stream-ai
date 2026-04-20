"use client";
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "super_admin" | "admin" | "operator" | "viewer";
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isSuperAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, session: null, loading: true, isSuperAdmin: false,
  signInWithGoogle: async () => {}, signOut: async () => {},
});

const AUTH_CACHE_KEY = "csai_auth_state";

function getCachedAuth(): { hasSession: boolean; profile: UserProfile | null } | null {
  if (typeof window === "undefined") return null;
  try { const c = localStorage.getItem(AUTH_CACHE_KEY); if (c) return JSON.parse(c); } catch {}
  return null;
}

function setCachedAuth(hasSession: boolean, profile: UserProfile | null) {
  if (typeof window === "undefined") return;
  try {
    if (hasSession) localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ hasSession, profile }));
    else localStorage.removeItem(AUTH_CACHE_KEY);
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cached = getCachedAuth();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(cached?.profile ?? null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!cached?.hasSession);
  const initDone = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const result = await supabase.from("users").select("*").eq("id", userId).single();
      if (result.data && !result.error) {
        setProfile(result.data as UserProfile);
        setCachedAuth(true, result.data as UserProfile);
      } else { setProfile(null); }
    } catch { setProfile(null); }
  }, []);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    let mounted = true;
    const safety = setTimeout(() => { if (mounted && loading) setLoading(false); }, 6000);

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        const s = data?.session ?? null;
        setSession(s); setUser(s?.user ?? null);
        if (s?.user) { setCachedAuth(true, profile); await fetchProfile(s.user.id); }
        else { setCachedAuth(false, null); setProfile(null); }
      } catch { setCachedAuth(false, null); }
      finally { if (mounted) setLoading(false); }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return;
      setSession(s); setUser(s?.user ?? null);
      if (s?.user) { setCachedAuth(true, profile); await fetchProfile(s.user.id); }
      else { setProfile(null); setCachedAuth(false, null); }
      setLoading(false);
    });

    return () => { mounted = false; clearTimeout(safety); subscription.unsubscribe(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { queryParams: { hd: "callstreamai.com" }, redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setSession(null); setCachedAuth(false, null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, isSuperAdmin: profile?.role === "super_admin", signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
