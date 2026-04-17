'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

export default function Dashboard() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getClients()
      .then(data => setClients(data.clients || []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: 'Total Clients', value: clients.length },
    { label: 'Active', value: clients.filter(c => c.status === 'active').length },
    { label: 'Draft', value: clients.filter(c => c.status === 'draft').length },
    { label: 'Verticals', value: new Set(clients.map(c => c.vertical)).size },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-[#888] text-sm mt-1">AI Operations Overview</p>
        </div>
        <Link href="/clients/new" className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
          New Client
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-5">
            <p className="text-[#888] text-xs uppercase tracking-wider">{stat.label}</p>
            <p className="text-3xl font-bold mt-2">{loading ? '—' : stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-semibold">Recent Clients</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Vertical</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-8 text-[#888]">Loading...</td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-[#888]">No clients yet. Create your first client to get started.</td></tr>
            ) : (
              clients.slice(0, 10).map((client) => (
                <tr key={client.id}>
                  <td className="font-medium">{client.name}</td>
                  <td><span className="px-2 py-0.5 bg-white/5 rounded text-xs">{client.vertical?.replace('_', ' ')}</span></td>
                  <td>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      client.status === 'active' ? 'bg-success/20 text-success' :
                      client.status === 'draft' ? 'bg-warning/20 text-warning' :
                      'bg-white/10 text-[#888]'
                    }`}>{client.status}</span>
                  </td>
                  <td className="text-[#888]">{new Date(client.created_at).toLocaleDateString()}</td>
                  <td>
                    <Link href={`/clients/${client.id}`} className="text-accent hover:text-accent-hover text-sm">
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
