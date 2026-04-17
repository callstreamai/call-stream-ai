'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [client, setClient] = useState<any>(null);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getClient(clientId),
      api.getDepartments(clientId).catch(() => ({ items: [] })),
      api.getDirectory(clientId).catch(() => ({ items: [] })),
      api.getRouting(clientId).catch(() => ({ items: [] })),
      api.getIntents(clientId).catch(() => ({ items: [] })),
      api.getKb(clientId).catch(() => ({ items: [] })),
      api.getDeployments(clientId).catch(() => ({ items: [] })),
    ]).then(([c, depts, dir, routing, intents, kb, deps]) => {
      setClient(c);
      setStats({
        departments: depts.items?.length || 0,
        directory: dir.items?.length || 0,
        routing: routing.items?.length || 0,
        intents: intents.items?.length || 0,
        kb: kb.items?.length || 0,
        deployments: deps.items?.length || 0,
      });
    }).finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <div className="text-[#888]">Loading client...</div>;
  if (!client) return <div className="text-danger">Client not found</div>;

  const sections = [
    { label: 'Departments', count: stats.departments, href: 'departments' },
    { label: 'Directory', count: stats.directory, href: 'directory' },
    { label: 'Hours of Operation', count: null, href: 'hours' },
    { label: 'Holiday Exceptions', count: null, href: 'holidays' },
    { label: 'Routing Rules', count: stats.routing, href: 'routing' },
    { label: 'Intents', count: stats.intents, href: 'intents' },
    { label: 'Knowledge Base', count: stats.kb, href: 'kb' },
    { label: 'Deployment Bindings', count: stats.deployments, href: 'deployments' },
    { label: 'Imports', count: null, href: 'imports' },
    { label: 'Audit Log', count: null, href: 'audit' },
    { label: 'Publish', count: null, href: 'publish' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs font-mono text-[#888]">{client.slug}</span>
            <span className="px-2 py-0.5 bg-white/5 rounded text-xs">{client.vertical?.replace(/_/g, ' ')}</span>
            <span className={`px-2 py-0.5 rounded text-xs ${client.status === 'active' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
              {client.status}
            </span>
          </div>
        </div>
        <Link href={`/clients/${clientId}/publish`} className="px-4 py-2 bg-success hover:bg-success/80 text-white rounded-lg text-sm font-medium transition-colors">
          Publish
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {sections.map(s => (
          <Link key={s.href} href={`/clients/${clientId}/${s.href}`} className="bg-card border border-border rounded-xl p-5 hover:border-border-light transition-colors group">
            <div className="flex items-center justify-between">
              <p className="font-medium group-hover:text-white transition-colors">{s.label}</p>
              {s.count !== null && <span className="text-2xl font-bold text-[#888]">{s.count}</span>}
            </div>
            <p className="text-xs text-accent mt-2 opacity-0 group-hover:opacity-100 transition-opacity">Manage →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
