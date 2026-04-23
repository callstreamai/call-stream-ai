'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

const verticals = [
  { value: 'hotels_resorts', label: 'Hotels & Resorts', desc: 'Full-service hotel and resort operations' },
  { value: 'travel', label: 'Travel', desc: 'Travel agency and tour operator operations' },
  { value: 'food_beverage', label: 'Food & Beverage', desc: 'Restaurant, bar, and food service operations' },
  { value: 'entertainment', label: 'Entertainment', desc: 'Venues, shows, and attractions' },
  { value: 'recreation_wellness', label: 'Recreation & Wellness', desc: 'Gyms, spas, and recreation centers' },
];

export default function CreateClientPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [vertical, setVertical] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');

  const handleCreate = async () => {
    if (!name || !vertical) { setError('Name and vertical are required'); return; }
    setCreating(true);
    setError('');
    try {
      const client = await api.createClient({ name, vertical, timezone });
      router.push(`/clients/${client.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create client');
      setCreating(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">Create New Client</h1>

      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Client Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., The Grand Hotel"
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-3">Select Vertical</label>
          <div className="grid grid-cols-1 gap-3">
            {verticals.map(v => (
              <button
                key={v.value}
                onClick={() => setVertical(v.value)}
                className={`text-left p-4 rounded-lg border transition-colors ${
                  vertical === v.value
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:border-border-light bg-black'
                }`}
              >
                <p className="font-medium">{v.label}</p>
                <p className="text-xs text-[#888] mt-1">{v.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Timezone</label>
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            className="w-full bg-black border border-border rounded-lg px-4 py-3"
          >
            <option value="America/New_York">Eastern (America/New_York)</option>
            <option value="America/Chicago">Central (America/Chicago)</option>
            <option value="America/Denver">Mountain (America/Denver)</option>
            <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
            <option value="America/Anchorage">Alaska (America/Anchorage)</option>
            <option value="Pacific/Honolulu">Hawaii (Pacific/Honolulu)</option>
            <option value="America/Phoenix">Arizona (America/Phoenix)</option>
            <option value="America/Puerto_Rico">Atlantic (America/Puerto_Rico)</option>
            <option value="Europe/London">London (Europe/London)</option>
            <option value="Europe/Paris">Paris (Europe/Paris)</option>
            <option value="Asia/Dubai">Dubai (Asia/Dubai)</option>
            <option value="Asia/Tokyo">Tokyo (Asia/Tokyo)</option>
            <option value="Australia/Sydney">Sydney (Australia/Sydney)</option>
          </select>
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={creating || !name || !vertical}
          className="w-full py-3 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {creating ? 'Creating & Loading Template...' : 'Create Client'}
        </button>

        <p className="text-xs text-[#666]">
          Selecting a vertical will automatically preload departments, intents, routing rules, hours, and knowledge base items from the template.
        </p>
      </div>
    </div>
  );
}
