'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function HoursPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [hours, setHours] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getHours(clientId).catch(() => ({ items: [] })),
      api.getDepartments(clientId).catch(() => ({ items: [] }))
    ]).then(([h, d]) => {
      setHours(h.items || []);
      setDepartments(d.items || []);
    }).finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <div className="text-[#888]">Loading hours...</div>;

  const grouped: Record<string, any[]> = {};
  for (const h of hours) {
    const deptName = h.departments?.name || h.departments?.code || 'Unknown';
    if (!grouped[deptName]) grouped[deptName] = [];
    grouped[deptName].push(h);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Hours of Operation</h1>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-[#888]">
          No hours configured yet. Hours are automatically loaded from the vertical template.
        </div>
      ) : (
        Object.entries(grouped).map(([deptName, deptHours]) => (
          <div key={deptName} className="bg-card border border-border rounded-xl mb-4">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold">{deptName}</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Open</th>
                  <th>Close</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day, idx) => {
                  const entry = deptHours.find((h: any) => h.day_of_week === idx);
                  return (
                    <tr key={idx}>
                      <td className="font-medium">{day}</td>
                      <td>{entry?.is_closed ? '—' : entry?.open_time || '—'}</td>
                      <td>{entry?.is_closed ? '—' : entry?.close_time || '—'}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded text-xs ${entry?.is_closed ? 'bg-danger/20 text-danger' : 'bg-success/20 text-success'}`}>
                          {entry?.is_closed ? 'Closed' : 'Open'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
