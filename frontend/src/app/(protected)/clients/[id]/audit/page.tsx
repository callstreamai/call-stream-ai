'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';

export default function AuditPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAuditLogs(clientId)
      .then(d => setLogs(d.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Audit Log</h1>
      <div className="bg-card border border-border rounded-xl">
        <table>
          <thead>
            <tr><th>Action</th><th>Entity</th><th>User</th><th>Timestamp</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-[#888]">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-[#888]">No audit logs yet</td></tr>
            ) : logs.map(log => (
              <tr key={log.id}>
                <td className="font-medium">{log.action}</td>
                <td className="text-[#888]">{log.entity_type}</td>
                <td className="text-[#888] text-xs">{log.user_id || '—'}</td>
                <td className="text-[#888] text-sm">{new Date(log.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
