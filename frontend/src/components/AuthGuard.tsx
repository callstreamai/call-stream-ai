"use client";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [showTimeout, setShowTimeout] = useState(false);

  // If loading takes more than 6 seconds, show a retry option
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setShowTimeout(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/signin");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#888] text-sm">Loading...</p>
          {showTimeout && (
            <div className="mt-4">
              <p className="text-[#555] text-xs mb-2">Taking longer than expected.</p>
              <button
                onClick={() => window.location.reload()}
                className="text-xs text-accent hover:text-accent/80 transition-colors"
              >
                Refresh page
              </button>
              <span className="text-[#333] mx-2">·</span>
              <button
                onClick={() => router.push("/signin")}
                className="text-xs text-[#888] hover:text-white transition-colors"
              >
                Sign in again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
