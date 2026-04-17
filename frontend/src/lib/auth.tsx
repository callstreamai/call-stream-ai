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
  user: null,
  profile: null,
  session: null,
  loading: true,
  isSuperAdmin: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

const AUTH_CACHE_KEY = "csai_auth_state";

function getCachedAuth(): { hasSession: boolean; profile: UserProfile | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
}

function setCachedAuth(hasSession: boolean, profile: UserProfile | null) {
  if (typeof window === "undefined") return;
  try {
    if (hasSession) {
      localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ hasSession, profile }));
    } else {
      localStorage.removeItem(AUTH_CACHE_KEY);
    }
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cached = getCachedAuth();
  
  // If we have a cached session, skip the loading state entirely
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(cached?.profile ?? null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!cached?.hasSession);
  const initDone = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const result = await supabase.from("users").select("*").eq("id", userId).single();
      const { data, error } = result;
      if (data && !error) {
        setProfile(data as UserProfile);
        setCachedAuth(true, data as UserProfile);
      } else {
        console.warn("Profile fetch issue:", error?.message);
        setProfile(null);
      }
    } catch (err) {
      console.warn("Profile fetch exception:", err);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    let mounted = true;

    // Safety net: force loading=false after 6 seconds
    const safetyTimer = setTimeout(() => {
      if (mounted && loading) {
        console.warn("Auth safety timeout");
        setLoading(false);
      }
    }, 6000);

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        const s = data?.session ?? null;
        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
          setCachedAuth(true, profile);
          await fetchProfile(s.user.id);
        } else {
          // No valid session — clear cache, will redirect to signin
          setCachedAuth(false, null);
          setProfile(null);
        }
      } catch (err) {
        console.warn("Auth init error:", err);
        setCachedAuth(false, null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        setCachedAuth(true, profile);
        await fetchProfile(s.user.id);
      } else {
        setProfile(null);
        setCachedAuth(false, null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        queryParams: { hd: "callstreamai.com" },
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error("Sign in error:", error);
      throw error;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    setCachedAuth(false, null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        isSuperAdmin: profile?.role === "super_admin",
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
