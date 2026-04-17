"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const navItems = [
  { href: "/", label: "Dashboard", icon: "◆" },
  { href: "/clients", label: "Clients", icon: "◇" },
  { href: "/preview", label: "Preview Simulator", icon: "▶" },
  { href: "/docs", label: "API Docs", icon: "◎" },
];

const clientNavItems = [
  { href: "departments", label: "Departments" },
  { href: "directory", label: "Directory" },
  { href: "hours", label: "Hours of Operation" },
  { href: "holidays", label: "Holiday Exceptions" },
  { href: "routing", label: "Routing Rules" },
  { href: "intents", label: "Intents" },
  { href: "kb", label: "Knowledge Base" },
  { href: "deployments", label: "Deployment Bindings" },
  { href: "imports", label: "Imports" },
  { href: "audit", label: "Audit Log" },
  { href: "publish", label: "Publish" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { profile, isSuperAdmin, signOut } = useAuth();
  const clientMatch = pathname.match(/\/clients\/([^/]+)/);
  const clientId = clientMatch ? clientMatch[1] : null;

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#0a0a0a] border-r border-[#222] flex flex-col z-50">
      <div className="p-6 border-b border-[#222]">
        <h1 className="text-lg font-bold tracking-tight">Call Stream AI</h1>
        <p className="text-xs text-[#666] mt-1">Operations Platform</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-3 mb-4">
          <p className="text-[10px] uppercase tracking-widest text-[#555] px-3 mb-2">
            Navigation
          </p>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === item.href
                  ? "bg-white/10 text-white"
                  : "text-[#888] hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="text-xs">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          {isSuperAdmin && (
            <Link
              href="/users"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === "/users"
                  ? "bg-white/10 text-white"
                  : "text-[#888] hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="text-xs">◈</span>
              User Management
            </Link>
          )}
        </div>

        {clientId && clientId !== "new" && (
          <div className="px-3 border-t border-[#222] pt-4">
            <p className="text-[10px] uppercase tracking-widest text-[#555] px-3 mb-2">
              Client Management
            </p>
            {clientNavItems.map((item) => {
              const fullHref = `/clients/${clientId}/${item.href}`;
              return (
                <Link
                  key={item.href}
                  href={fullHref}
                  className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    pathname === fullHref
                      ? "bg-white/10 text-white"
                      : "text-[#888] hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-[#222]">
        {profile && (
          <div className="flex items-center gap-3 mb-3">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
                {(profile.full_name || profile.email)?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {profile.full_name || profile.email}
              </p>
              <p className="text-[10px] text-[#555] truncate">{profile.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className="w-full px-3 py-1.5 text-xs text-[#888] hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
