"use client";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, session } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !user && !session) {
      localStorage.removeItem("csai_auth_state");
      router.push("/signin");
    }
  }, [user, loading, session, router, mounted]);

  // Before mount (SSR + first client render): always render children
  // This prevents the loading flash since SSR can't check localStorage
  if (!mounted) {
    return <>{children}</>;
  }

  // After mount: if still loading AND no cached session, show spinner
  if (loading) {
    const hasCachedSession = !!localStorage.getItem("csai_auth_state");
    if (hasCachedSession) {
      // Cached session exists — render children while validating in background
      return <>{children}</>;
    }
    // No cache, genuinely unknown — show brief spinner
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#888] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Loaded, no user — redirect happening, show nothing
  if (!user) return null;

  return <>{children}</>;
}
