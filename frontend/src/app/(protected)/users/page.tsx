"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

export default function UserManagementPage() {
  const { isSuperAdmin, profile } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin && !loading) {
      router.push("/");
    }
  }, [isSuperAdmin, loading, router]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (data && !error) {
      setUsers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchUsers();
    }
  }, [isSuperAdmin]);

  const updateRole = async (userId: string, newRole: string) => {
    if (userId === profile?.id) {
      alert("You cannot change your own role.");
      return;
    }
    setActionLoading(userId);
    const { error } = await supabase
      .from("users")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) {
      alert("Failed to update role: " + error.message);
    } else {
      await fetchUsers();
    }
    setActionLoading(null);
  };

  const deleteUser = async (userId: string, email: string) => {
    if (userId === profile?.id) {
      alert("You cannot delete your own account.");
      return;
    }
    if (!confirm(`Are you sure you want to remove ${email}? This will revoke their access.`)) {
      return;
    }
    setActionLoading(userId);

    // Delete from public.users (the auth.users entry remains but they won't have a profile)
    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (error) {
      alert("Failed to delete user: " + error.message);
    } else {
      await fetchUsers();
    }
    setActionLoading(null);
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#888]">Access denied. Super Admin only.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-[#888] text-sm mt-1">
            Manage team access and roles. Only @callstreamai.com users can sign in.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#888]">Total users</p>
          <p className="text-2xl font-bold">{users.length}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-[#888]">
                  Loading users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-[#888]">
                  No users yet. Users are created automatically on first sign-in.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt=""
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold">
                          {(u.full_name || u.email)?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium">
                        {u.full_name || "—"}
                        {u.id === profile?.id && (
                          <span className="text-xs text-[#555] ml-2">(you)</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="text-[#888] font-mono text-xs">{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      disabled={u.id === profile?.id || actionLoading === u.id}
                      className="text-xs !py-1 !px-2 !bg-transparent !border-[#333] disabled:opacity-50"
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="admin">Admin</option>
                      <option value="operator">Operator</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td className="text-[#888] text-sm">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="text-right">
                    {u.id !== profile?.id && (
                      <button
                        onClick={() => deleteUser(u.id, u.email)}
                        disabled={actionLoading === u.id}
                        className="text-danger text-xs hover:text-danger/80 disabled:opacity-50"
                      >
                        {actionLoading === u.id ? "..." : "Remove"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3">Role Permissions</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-white">Super Admin</p>
            <p className="text-[#888] text-xs mt-1">
              Full access. Can manage users, assign roles, delete accounts, and access all platform features.
            </p>
          </div>
          <div>
            <p className="font-medium text-white">Admin</p>
            <p className="text-[#888] text-xs mt-1">
              Full platform access. Can manage clients, configurations, and deployments. Cannot manage users.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
