'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '◆' },
  { href: '/clients', label: 'Clients', icon: '◇' },
  { href: '/preview', label: 'Preview Simulator', icon: '▶' },
];

const clientNavItems = [
  { href: 'departments', label: 'Departments' },
  { href: 'directory', label: 'Directory' },
  { href: 'hours', label: 'Hours of Operation' },
  { href: 'holidays', label: 'Holiday Exceptions' },
  { href: 'routing', label: 'Routing Rules' },
  { href: 'intents', label: 'Intents' },
  { href: 'kb', label: 'Knowledge Base' },
  { href: 'deployments', label: 'Deployment Bindings' },
  { href: 'imports', label: 'Imports' },
  { href: 'audit', label: 'Audit Log' },
  { href: 'publish', label: 'Publish' },
];

export default function Sidebar() {
  const pathname = usePathname();
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
          <p className="text-[10px] uppercase tracking-widest text-[#555] px-3 mb-2">Navigation</p>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-white/10 text-white'
                  : 'text-[#888] hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="text-xs">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>

        {clientId && clientId !== 'new' && (
          <div className="px-3 border-t border-[#222] pt-4">
            <p className="text-[10px] uppercase tracking-widest text-[#555] px-3 mb-2">Client Management</p>
            {clientNavItems.map((item) => {
              const fullHref = `/clients/${clientId}/${item.href}`;
              return (
                <Link
                  key={item.href}
                  href={fullHref}
                  className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    pathname === fullHref
                      ? 'bg-white/10 text-white'
                      : 'text-[#888] hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-[#222] text-xs text-[#555]">
        v1.0.0
      </div>
    </aside>
  );
}
