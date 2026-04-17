"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Auth callback error:", error);
        router.push("/signin?error=auth_failed");
        return;
      }

      if (data.session) {
        // Check domain
        const email = data.session.user.email || "";
        if (!email.endsWith("@callstreamai.com")) {
          await supabase.auth.signOut();
          router.push("/signin?error=unauthorized_domain");
          return;
        }
        router.push("/");
      } else {
        router.push("/signin");
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[#888] text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
