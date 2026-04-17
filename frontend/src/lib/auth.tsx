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

// Helper: race a promise against a timeout
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initDone = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from("users").select("*").eq("id", userId).single(),
        5000,
        { data: null, error: { message: "Profile fetch timed out" } } as any
      );
      if (data && !error) {
        setProfile(data as UserProfile);
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
    // Prevent double-init in React strict mode
    if (initDone.current) return;
    initDone.current = true;

    let mounted = true;

    // Safety net: force loading=false after 8 seconds no matter what
    const safetyTimer = setTimeout(() => {
      if (mounted && loading) {
        console.warn("Auth safety timeout — forcing loading=false");
        setLoading(false);
      }
    }, 8000);

    const init = async () => {
      try {
        const sessionResult = await withTimeout(
          supabase.auth.getSession(),
          5000,
          { data: { session: null } } as any
        );
        
        if (!mounted) return;

        const s = sessionResult?.data?.session ?? null;
        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
          await fetchProfile(s.user.id);
        }
      } catch (err) {
        console.warn("Auth init error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        if (!mounted) return;
        setSession(s);
        setUser(s?.user ?? null);

        if (s?.user) {
          await fetchProfile(s.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

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
