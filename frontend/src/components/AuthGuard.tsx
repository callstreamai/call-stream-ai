"use client";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, session } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only redirect to signin when we're SURE there's no session
    // (loading is done AND no user)
    if (!loading && !user && !session) {
      // Check localStorage cache — if it says we had a session,
      // give the async validation a moment before redirecting
      const cached = localStorage.getItem("csai_auth_state");
      if (cached) {
        // Cache exists but session check failed — session expired
        localStorage.removeItem("csai_auth_state");
      }
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        router.push("/signin");
      }
    }
  }, [user, loading, session, router]);

  // If loading AND no cached session, show spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#888] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // If no user and no cached profile, show nothing (redirect happening)
  if (!user && !loading) {
    // Check if we have cached auth — if so, render children while validating
    const cached = localStorage.getItem("csai_auth_state");
    if (cached) {
      return <>{children}</>;
    }
    return null;
  }

  return <>{children}</>;
}
