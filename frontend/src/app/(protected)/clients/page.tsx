'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getClients().then(d => setClients(d.clients || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link href="/clients/new" className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
          Create Client
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl">
        <table>
          <thead>
            <tr><th>Name</th><th>Slug</th><th>Vertical</th><th>Status</th><th>Created</th><th></th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-[#888]">Loading...</td></tr>
            ) : clients.map(c => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td className="text-[#888] font-mono text-xs">{c.slug}</td>
                <td><span className="px-2 py-0.5 bg-white/5 rounded text-xs">{c.vertical?.replace(/_/g, ' ')}</span></td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-xs ${c.status === 'active' ? 'bg-success/20 text-success' : c.status === 'draft' ? 'bg-warning/20 text-warning' : 'bg-white/10 text-[#888]'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="text-[#888] text-sm">{new Date(c.created_at).toLocaleDateString()}</td>
                <td><Link href={`/clients/${c.id}`} className="text-accent text-sm hover:text-accent-hover">Manage →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
