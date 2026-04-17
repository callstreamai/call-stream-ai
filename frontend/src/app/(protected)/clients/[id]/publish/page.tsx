'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';

export default function PublishPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [notes, setNotes] = useState('');

  const fetchVersions = () => {
    api.getVersions(clientId)
      .then(d => setVersions(d.versions || []))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchVersions(); }, [clientId]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await api.publish(clientId, notes || undefined);
      setNotes('');
      fetchVersions();
    } catch (err: any) {
      alert(err.message);
    }
    setPublishing(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Publish</h1>

      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h3 className="font-semibold mb-4">Publish New Version</h3>
        <p className="text-sm text-[#888] mb-4">
          Publishing takes a snapshot of the current configuration and makes it live.
          Cache will be invalidated for all runtime endpoints.
        </p>
        <div className="mb-4">
          <label className="block text-xs text-[#888] mb-1">Notes (optional)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., Updated dining hours" className="w-full" />
        </div>
        <button onClick={handlePublish} disabled={publishing} className="px-6 py-2.5 bg-success hover:bg-success/80 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
          {publishing ? 'Publishing...' : 'Publish Now'}
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Version History</h3>
        </div>
        <table>
          <thead>
            <tr><th>Version</th><th>Notes</th><th>Status</th><th>Published</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-[#888]">Loading...</td></tr>
            ) : versions.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-[#888]">No versions published yet</td></tr>
            ) : versions.map(v => (
              <tr key={v.id}>
                <td className="font-mono font-bold">v{v.version_number}</td>
                <td className="text-[#888]">{v.notes || '—'}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-xs ${v.is_active ? 'bg-success/20 text-success' : 'bg-white/10 text-[#888]'}`}>
                    {v.is_active ? 'Active' : 'Archived'}
                  </span>
                </td>
                <td className="text-[#888] text-sm">{new Date(v.published_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
