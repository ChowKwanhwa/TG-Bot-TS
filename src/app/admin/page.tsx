"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  trialExpiresAt: string | null;
  createdAt: string;
  _count: { tgSessions: number; tasks: number };
}

interface Stats {
  totalUsers: number;
  aliveSessions: number;
  activeTasks: number;
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    aliveSessions: 0,
    activeTasks: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
      setStats(data.stats);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleAction(
    userId: string,
    action: "activate" | "suspend" | "extend_trial"
  ) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    fetchUsers();
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString();
  }

  function trialStatus(user: UserRow) {
    if (user.role !== "TRIAL" || !user.trialExpiresAt) return null;
    const remaining = new Date(user.trialExpiresAt).getTime() - Date.now();
    if (remaining <= 0) return "Expired";
    const mins = Math.floor(remaining / 60000);
    const hrs = Math.floor(mins / 60);
    return hrs > 0 ? `${hrs}h ${mins % 60}m left` : `${mins}m left`;
  }

  const roleBadge: Record<string, string> = {
    SUPER_ADMIN: "border border-red-500/20 bg-red-500/10 text-red-300",
    ACTIVE: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    TRIAL: "border border-amber-500/20 bg-amber-500/10 text-amber-300",
    SUSPENDED: "border border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
  };

  const statCards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      color: "from-violet-500 to-fuchsia-500",
    },
    {
      label: "Alive Sessions",
      value: stats.aliveSessions,
      color: "from-emerald-500 to-teal-500",
    },
    {
      label: "Active Tasks",
      value: stats.activeTasks,
      color: "from-amber-500 to-orange-500",
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Admin Dashboard</h2>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((s) => (
          <Card
            key={s.label}
            className="border-white/5 bg-white/[0.03] backdrop-blur-sm"
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${s.color} text-sm font-bold text-white shadow-lg`}
              >
                {s.value}
              </div>
              <span className="text-sm text-zinc-400">{s.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* User Management Table */}
      <Card className="border-white/5 bg-white/[0.03] backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">All Registered Users</CardTitle>
          <CardDescription>
            Manage roles, activate accounts, or extend trial periods.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-zinc-500">No users registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-zinc-400">
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Role</th>
                    <th className="pb-2 pr-4">Trial</th>
                    <th className="pb-2 pr-4">Sessions</th>
                    <th className="pb-2 pr-4">Tasks</th>
                    <th className="pb-2 pr-4">Registered</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="py-3 pr-4 font-medium text-zinc-200">
                        {u.email}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${roleBadge[u.role] ?? ""}`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-zinc-500">
                        {trialStatus(u) ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-zinc-300">
                        {u._count.tgSessions}
                      </td>
                      <td className="py-3 pr-4 text-zinc-300">
                        {u._count.tasks}
                      </td>
                      <td className="py-3 pr-4 text-xs text-zinc-500">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="py-3">
                        {u.role !== "SUPER_ADMIN" && (
                          <div className="flex gap-1">
                            {u.role !== "ACTIVE" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAction(u.id, "activate")}
                                className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                              >
                                Activate
                              </Button>
                            )}
                            {u.role !== "SUSPENDED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAction(u.id, "suspend")}
                                className="border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                              >
                                Suspend
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleAction(u.id, "extend_trial")
                              }
                              className="border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                            >
                              +3h Trial
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
