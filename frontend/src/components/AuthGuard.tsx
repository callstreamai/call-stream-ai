"use client";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, session } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !loading && !user && !session) {
      localStorage.removeItem("csai_auth_state");
      router.push("/signin");
    }
  }, [user, loading, session, router, mounted]);

  if (!mounted) return <>{children}</>;

  if (loading) {
    const hasCached = typeof window !== "undefined" && !!localStorage.getItem("csai_auth_state");
    if (hasCached) return <>{children}</>;
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#888] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
