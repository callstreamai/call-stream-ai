'use client';
import { useState } from 'react';
import api from '@/lib/api';

export default function PreviewPage() {
  const [form, setForm] = useState({
    clientId: '',
    workerId: '',
    deploymentId: '',
    channel: 'voice',
    intent: '',
    department: '',
    timestamp: '',
  });
  const [result, setResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState('');

  const handleSimulate = async () => {
    setSimulating(true);
    setError('');
    setResult(null);
    try {
      const data = await api.simulate(form);
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    }
    setSimulating(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Preview Simulator</h1>
      <p className="text-[#888] text-sm mb-8">Test how the AI will behave for a given scenario</p>

      <div className="grid grid-cols-2 gap-8">
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-semibold mb-4">Simulation Input</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[#888] mb-1">Client ID</label>
              <input type="text" value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})} placeholder="UUID" className="w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-1">Deployment ID</label>
              <input type="text" value={form.deploymentId} onChange={e => setForm({...form, deploymentId: e.target.value})} placeholder="dep_123" className="w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-1">Worker ID</label>
              <input type="text" value={form.workerId} onChange={e => setForm({...form, workerId: e.target.value})} placeholder="wrk_123" className="w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-1">Channel</label>
              <select value={form.channel} onChange={e => setForm({...form, channel: e.target.value})} className="w-full text-sm">
                <option value="voice">Voice</option>
                <option value="chat">Chat</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-1">Department Code</label>
              <input type="text" value={form.department} onChange={e => setForm({...form, department: e.target.value})} placeholder="e.g., dining" className="w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-1">Intent Key</label>
              <input type="text" value={form.intent} onChange={e => setForm({...form, intent: e.target.value})} placeholder="e.g., dining_reservation" className="w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-1">Timestamp (optional)</label>
              <input type="text" value={form.timestamp} onChange={e => setForm({...form, timestamp: e.target.value})} placeholder="2026-04-16T20:00:00-04:00" className="w-full text-sm" />
            </div>
            <button onClick={handleSimulate} disabled={simulating || !form.clientId} className="w-full py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {simulating ? 'Simulating...' : 'Run Simulation'}
            </button>
          </div>
        </div>

        <div>
          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 mb-4">
              <p className="text-danger text-sm">{error}</p>
            </div>
          )}

          {result && (
            <>
              <div className="bg-card border border-border rounded-xl p-6 mb-4">
                <h3 className="font-semibold mb-4">Resolution Steps</h3>
                <div className="space-y-3">
                  {result.steps?.map((step: any, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs mt-0.5 ${
                        step.status === 'found' || step.status === 'matched' || step.status === 'open' || step.status === 'applied'
                          ? 'bg-success/20 text-success'
                          : step.status === 'closed'
                          ? 'bg-warning/20 text-warning'
                          : 'bg-white/10 text-[#888]'
                      }`}>{step.status}</span>
                      <div>
                        <p className="text-sm font-medium">{step.step}</p>
                        {step.data && <pre className="text-xs text-[#888] mt-1 overflow-auto">{JSON.stringify(step.data, null, 2)}</pre>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="font-semibold mb-4">API Response (what Brainbase receives)</h3>
                <pre className="text-xs text-[#ccc] bg-black/50 rounded-lg p-4 overflow-auto max-h-96">
                  {JSON.stringify(result.finalResponse, null, 2)}
                </pre>
              </div>
            </>
          )}

          {!result && !error && (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-[#888]">
              <p className="text-lg mb-2">▶</p>
              <p className="text-sm">Run a simulation to see how the AI will respond</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
