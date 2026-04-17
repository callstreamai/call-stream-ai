"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Puerto_Rico", label: "Atlantic (AST)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central Europe (CET)" },
  { value: "Asia/Tokyo", label: "Japan (JST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

// Generate time options in 15-min increments, AM/PM format
function generateTimeOptions() {
  const options: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hh = h.toString().padStart(2, "0");
      const mm = m.toString().padStart(2, "0");
      const value = `${hh}:${mm}:00`;
      const period = h < 12 ? "AM" : "PM";
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const label = `${displayH}:${mm} ${period}`;
      options.push({ value, label });
    }
  }
  // Add 11:59 PM as a closing option
  options.push({ value: "23:59:00", label: "11:59 PM" });
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

function formatTime(time24: string | null): string {
  if (!time24) return "—";
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr || "00";
  const period = h < 12 ? "AM" : "PM";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${m} ${period}`;
}

interface HourEntry {
  id?: string;
  client_id?: string;
  department_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  timezone: string;
}

export default function HoursPage() {
  const params = useParams();
  const clientId = params.id as string;
  const [hours, setHours] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingDept, setEditingDept] = useState<string | null>(null);
  const [editRows, setEditRows] = useState<Record<number, HourEntry>>({});
  const [tzSaving, setTzSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [h, d, c] = await Promise.all([
        api.getHours(clientId).catch(() => ({ items: [] })),
        api.getDepartments(clientId).catch(() => ({ items: [] })),
        api.getClient(clientId).catch(() => null),
      ]);
      setHours(h.items || []);
      setDepartments(d.items || []);
      setClient(c);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const updateTimezone = async (tz: string) => {
    setTzSaving(true);
    try {
      await api.updateClient(clientId, { timezone: tz });
      // Also update all existing hours to the new timezone
      if (hours.length > 0) {
        const updated = hours.map((h) => ({
          ...h,
          timezone: tz,
          departments: undefined,
        }));
        await api.upsertHours(clientId, updated);
      }
      await load();
    } catch (err) {
      console.error("Failed to update timezone:", err);
    }
    setTzSaving(false);
  };

  const startEditing = (deptId: string) => {
    const deptHours = hours.filter((h) => h.department_id === deptId);
    const rows: Record<number, HourEntry> = {};
    for (let d = 0; d < 7; d++) {
      const existing = deptHours.find((h: any) => h.day_of_week === d);
      rows[d] = existing
        ? { ...existing }
        : {
            department_id: deptId,
            day_of_week: d,
            open_time: "09:00:00",
            close_time: "17:00:00",
            is_closed: false,
            timezone: client?.timezone || "America/New_York",
          };
    }
    setEditRows(rows);
    setEditingDept(deptId);
  };

  const saveEditing = async () => {
    setSaving(true);
    try {
      const entries = Object.values(editRows).map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        client_id: clientId,
        department_id: r.department_id,
        day_of_week: r.day_of_week,
        open_time: r.open_time,
        close_time: r.close_time,
        is_closed: r.is_closed,
        timezone: client?.timezone || "America/New_York",
      }));
      await api.upsertHours(clientId, entries);
      await load();
      setEditingDept(null);
    } catch (err) {
      console.error("Failed to save hours:", err);
    }
    setSaving(false);
  };

  if (loading)
    return <div className="text-[#888]">Loading hours...</div>;

  // Group hours by department
  const grouped: Record<string, { name: string; id: string; hours: any[] }> =
    {};
  for (const dept of departments) {
    grouped[dept.id] = {
      name: dept.name,
      id: dept.id,
      hours: hours.filter((h) => h.department_id === dept.id),
    };
  }

  const currentTz = client?.timezone || "America/New_York";
  const tzLabel =
    TIMEZONES.find((t) => t.value === currentTz)?.label || currentTz;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Hours of Operation</h1>
          <p className="text-[#888] text-sm mt-1">
            Set operating hours per department. Times are displayed in AM/PM
            format.
          </p>
        </div>
      </div>

      {/* Timezone selector */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 flex items-center gap-4">
        <div className="flex-1">
          <label className="text-xs text-[#888] block mb-1">
            Client Timezone
          </label>
          <select
            value={currentTz}
            onChange={(e) => updateTimezone(e.target.value)}
            disabled={tzSaving}
            className="!bg-[#111] !border-[#333] text-sm"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#888]">Current timezone</p>
          <p className="text-sm font-medium">{tzLabel}</p>
          {tzSaving && (
            <p className="text-xs text-accent">Updating...</p>
          )}
        </div>
      </div>

      {/* Department hours grids */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-[#888]">
          No departments configured. Add departments first to set hours.
        </div>
      ) : (
        Object.entries(grouped).map(([deptId, dept]) => {
          const isEditing = editingDept === deptId;

          return (
            <div
              key={deptId}
              className="bg-card border border-border rounded-xl mb-4"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold">{dept.name}</h3>
                {isEditing ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingDept(null)}
                      className="text-xs text-[#888] hover:text-white px-3 py-1 rounded-lg border border-[#333] hover:border-[#555] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEditing}
                      disabled={saving}
                      className="text-xs bg-accent text-black px-3 py-1 rounded-lg hover:bg-accent/80 disabled:opacity-50 transition-colors"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditing(deptId)}
                    className="text-xs text-accent hover:text-accent/80 transition-colors"
                  >
                    Edit Hours
                  </button>
                )}
              </div>

              <table>
                <thead>
                  <tr>
                    <th className="w-36">Day</th>
                    <th>Opens</th>
                    <th>Closes</th>
                    <th className="w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((dayName, dayIdx) => {
                    if (isEditing) {
                      const row = editRows[dayIdx];
                      return (
                        <tr key={dayIdx}>
                          <td className="font-medium">{dayName}</td>
                          <td>
                            {row?.is_closed ? (
                              <span className="text-[#555]">—</span>
                            ) : (
                              <select
                                value={row?.open_time || "09:00:00"}
                                onChange={(e) =>
                                  setEditRows((prev) => ({
                                    ...prev,
                                    [dayIdx]: {
                                      ...prev[dayIdx],
                                      open_time: e.target.value,
                                    },
                                  }))
                                }
                                className="!bg-[#111] !border-[#333] text-sm !py-1 !px-2"
                              >
                                {TIME_OPTIONS.map((t) => (
                                  <option key={t.value} value={t.value}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td>
                            {row?.is_closed ? (
                              <span className="text-[#555]">—</span>
                            ) : (
                              <select
                                value={row?.close_time || "17:00:00"}
                                onChange={(e) =>
                                  setEditRows((prev) => ({
                                    ...prev,
                                    [dayIdx]: {
                                      ...prev[dayIdx],
                                      close_time: e.target.value,
                                    },
                                  }))
                                }
                                className="!bg-[#111] !border-[#333] text-sm !py-1 !px-2"
                              >
                                {TIME_OPTIONS.map((t) => (
                                  <option key={t.value} value={t.value}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td>
                            <button
                              onClick={() =>
                                setEditRows((prev) => ({
                                  ...prev,
                                  [dayIdx]: {
                                    ...prev[dayIdx],
                                    is_closed: !prev[dayIdx].is_closed,
                                  },
                                }))
                              }
                              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                                row?.is_closed
                                  ? "bg-danger/20 text-danger hover:bg-danger/30"
                                  : "bg-success/20 text-success hover:bg-success/30"
                              }`}
                            >
                              {row?.is_closed ? "Closed" : "Open"}
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    // Read-only view
                    const entry = dept.hours.find(
                      (h: any) => h.day_of_week === dayIdx
                    );
                    return (
                      <tr key={dayIdx}>
                        <td className="font-medium">{dayName}</td>
                        <td>
                          {entry?.is_closed
                            ? "—"
                            : formatTime(entry?.open_time)}
                        </td>
                        <td>
                          {entry?.is_closed
                            ? "—"
                            : formatTime(entry?.close_time)}
                        </td>
                        <td>
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${
                              entry?.is_closed
                                ? "bg-danger/20 text-danger"
                                : entry
                                ? "bg-success/20 text-success"
                                : "bg-[#333]/50 text-[#666]"
                            }`}
                          >
                            {entry?.is_closed
                              ? "Closed"
                              : entry
                              ? "Open"
                              : "Not set"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}
