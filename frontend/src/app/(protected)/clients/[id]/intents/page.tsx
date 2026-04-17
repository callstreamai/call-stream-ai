'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';

interface Item { [key: string]: any; }

export default function Page() {
  const params = useParams();
  const clientId = params.id as string;
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchItems = () => {
    api.getIntents(clientId)
      .then(d => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, [clientId]);

  const handleSave = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      if (editItem.id) {
        await api.updateIntent(clientId, editItem.id, editItem);
      } else {
        await api.createIntent(clientId, editItem);
      }
      setShowForm(false);
      setEditItem(null);
      fetchItems();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    try { await api.deleteIntent(clientId, id); fetchItems(); } catch (err: any) { alert(err.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Intents</h1>
        <button onClick={() => { setEditItem({}); setShowForm(true); }} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors">
          Add New
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{editItem?.id ? 'Edit' : 'Create'} Item</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#888] mb-1">Intent Key</label>
              <input type="text" value={editItem?.intent_key || ''} onChange={e => setEditItem({...editItem!, intent_key: e.target.value})} className="w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888] mb-1">Label</label>
              <input type="text" value={editItem?.label || ''} onChange={e => setEditItem({...editItem!, label: e.target.value})} className="w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888] mb-1">Department Code</label>
              <input type="text" value={editItem?.department_code || ''} onChange={e => setEditItem({...editItem!, department_code: e.target.value})} className="w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888] mb-1">Description</label>
              <input type="text" value={editItem?.description || ''} onChange={e => setEditItem({...editItem!, description: e.target.value})} className="w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888] mb-1">Priority</label>
              <input type="text" value={editItem?.priority || ''} onChange={e => setEditItem({...editItem!, priority: e.target.value})} className="w-full text-sm" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setShowForm(false); setEditItem(null); }} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl">
        <table>
          <thead>
            <tr>
              <th>Intent Key</th>
              <th>Label</th>
              <th>Department Code</th>
              <th>Priority</th>
              <th>Is Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-[#888]">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-[#888]">No items yet</td></tr>
            ) : items.map(item => (
              <tr key={item.id}>
                  <td>{String(item.intent_key ?? "—")}</td>
                  <td>{String(item.label ?? "—")}</td>
                  <td>{String(item.department_code ?? "—")}</td>
                  <td>{String(item.priority ?? "—")}</td>
                  <td>{String(item.is_active ?? "—")}</td>
                <td className="text-right">
                  <button onClick={() => { setEditItem(item); setShowForm(true); }} className="text-accent text-xs mr-3 hover:text-accent-hover">Edit</button>
                  <button onClick={() => handleDelete(item.id)} className="text-danger text-xs hover:text-danger/80">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
