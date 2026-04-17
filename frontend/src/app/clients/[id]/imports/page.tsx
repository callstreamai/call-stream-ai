'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';

export default function ImportsPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [imports, setImports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [targetTable, setTargetTable] = useState('kb_items');

  const fetchImports = () => {
    api.getImports(clientId)
      .then(d => setImports(d.imports || []))
      .catch(() => setImports([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchImports(); }, [clientId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('target_table', targetTable);
      await api.uploadImport(clientId, formData);
      fetchImports();
    } catch (err: any) {
      alert(err.message);
    }
    setUploading(false);
  };

  const handleApprove = async (importId: string) => {
    try {
      await api.approveImport(clientId, importId);
      fetchImports();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const tables = ['kb_items', 'directory_entries', 'intents', 'routing_rules', 'departments', 'holiday_exceptions'];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">CSV Import</h1>

      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <h3 className="font-semibold mb-4">Upload CSV</h3>
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-xs text-[#888] mb-1">Target Table</label>
            <select value={targetTable} onChange={e => setTargetTable(e.target.value)} className="text-sm">
              {tables.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#888] mb-1">CSV File</label>
            <input type="file" accept=".csv" onChange={handleUpload} disabled={uploading} className="text-sm" />
          </div>
          {uploading && <p className="text-sm text-accent">Uploading...</p>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold">Import History</h3>
        </div>
        <table>
          <thead>
            <tr><th>File</th><th>Target</th><th>Status</th><th>Rows</th><th>Errors</th><th></th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-[#888]">Loading...</td></tr>
            ) : imports.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-[#888]">No imports yet</td></tr>
            ) : imports.map(imp => (
              <tr key={imp.id}>
                <td className="font-medium">{imp.file_name}</td>
                <td className="text-[#888] text-xs">{imp.target_table}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    imp.status === 'completed' ? 'bg-success/20 text-success' :
                    imp.status === 'failed' ? 'bg-danger/20 text-danger' :
                    imp.status === 'ready' ? 'bg-accent/20 text-accent' :
                    'bg-white/10 text-[#888]'
                  }`}>{imp.status}</span>
                </td>
                <td>{imp.valid_rows}/{imp.total_rows}</td>
                <td className={imp.error_rows > 0 ? 'text-danger' : 'text-[#888]'}>{imp.error_rows}</td>
                <td>
                  {imp.status === 'ready' && (
                    <button onClick={() => handleApprove(imp.id)} className="text-success text-xs hover:text-success/80">
                      Approve & Import
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
