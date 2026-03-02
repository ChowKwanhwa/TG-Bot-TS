"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserPen, Trash2, Phone, AtSign, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TgSession {
  id: string;
  phone: string;
  tgFirstName: string | null;
  tgLastName: string | null;
  tgUsername: string | null;
  isAlive: boolean;
  lastUsedAt: string | null;
}

export default function ProfileModifierPage() {
  const [sessions, setSessions] = useState<TgSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Edit dialog state
  const [editSession, setEditSession] = useState<TgSession | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/sessions/list");
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  function openEditDialog(session: TgSession) {
    setEditSession(session);
    setEditFirstName(session.tgFirstName ?? "");
    setEditLastName(session.tgLastName ?? "");
  }

  async function handleEditSubmit() {
    if (!editSession) return;
    setSubmitting(true);
    const res = await fetch("/api/tasks/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tgSessionId: editSession.id,
        type: "PROFILE_MODIFY",
        config: { firstName: editFirstName, lastName: editLastName },
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok || data.error) {
      toast.error(data.error ?? "Failed to create task");
      return;
    }
    toast.success("Profile modify task created");
    setEditSession(null);
  }

  async function handleDelete(sessionId: string) {
    setDeleting(sessionId);
    const res = await fetch("/api/sessions/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (res.ok) {
      toast.success("Session deleted");
      fetchSessions();
    } else {
      toast.error("Failed to delete session");
    }
    setDeleting(null);
  }

  const aliveSessions = sessions.filter((s) => s.isAlive);
  const deadSessions = sessions.filter((s) => !s.isAlive);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserPen className="h-6 w-6 text-violet-400" />
        <h2 className="text-2xl font-bold text-white">Profile Modifier</h2>
      </div>
      <p className="text-sm text-zinc-400">
        Select a session to edit its Telegram profile name, or delete sessions
        you no longer need.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading sessions...
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-white/5 bg-white/[0.03] backdrop-blur-sm">
          <CardContent className="py-12 text-center">
            <p className="text-zinc-500">
              No sessions found. Add a session first in the Sessions page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Alive Sessions */}
          {aliveSessions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-400">
                Active Sessions ({aliveSessions.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {aliveSessions.map((s) => (
                  <Card
                    key={s.id}
                    className="group border-white/5 bg-white/[0.03] backdrop-blur-sm transition-all duration-300 hover:border-white/10 hover:bg-white/[0.06]"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base text-white">
                            {s.tgFirstName ?? "Unknown"}{" "}
                            {s.tgLastName ?? ""}
                          </CardTitle>
                          <div className="flex items-center gap-3 text-xs text-zinc-400">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {s.phone}
                            </span>
                            {s.tgUsername && (
                              <span className="flex items-center gap-1">
                                <AtSign className="h-3 w-3" />
                                {s.tgUsername}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300">
                          Alive
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="flex gap-2 pt-0">
                      <Button
                        size="sm"
                        onClick={() => openEditDialog(s)}
                        className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-xs font-semibold text-white shadow-lg shadow-violet-600/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-violet-600/40"
                      >
                        <UserPen className="mr-1.5 h-3.5 w-3.5" />
                        Edit Profile
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(s.id)}
                        disabled={deleting === s.id}
                        className="border-red-500/20 bg-red-500/10 text-xs text-red-300 hover:bg-red-500/20 hover:text-red-200"
                      >
                        {deleting === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Dead Sessions */}
          {deadSessions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-500">
                Inactive Sessions ({deadSessions.length})
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {deadSessions.map((s) => (
                  <Card
                    key={s.id}
                    className="border-white/5 bg-white/[0.02] opacity-60"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base text-zinc-400">
                            {s.tgFirstName ?? "Unknown"}{" "}
                            {s.tgLastName ?? ""}
                          </CardTitle>
                          <div className="flex items-center gap-3 text-xs text-zinc-500">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {s.phone}
                            </span>
                          </div>
                        </div>
                        <span className="rounded-md border border-zinc-500/20 bg-zinc-500/10 px-2 py-0.5 text-xs font-medium text-zinc-500">
                          Dead
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(s.id)}
                        disabled={deleting === s.id}
                        className="border-red-500/20 bg-red-500/10 text-xs text-red-300 hover:bg-red-500/20 hover:text-red-200"
                      >
                        {deleting === s.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Delete
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Profile Dialog */}
      <Dialog
        open={editSession !== null}
        onOpenChange={(open) => {
          if (!open) setEditSession(null);
        }}
      >
        <DialogContent className="border-white/10 bg-zinc-900 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Update the Telegram profile for{" "}
              <span className="font-medium text-zinc-300">
                {editSession?.tgUsername
                  ? `@${editSession.tgUsername}`
                  : editSession?.phone}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-first">First Name</Label>
              <Input
                id="edit-first"
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                placeholder="New first name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-last">Last Name</Label>
              <Input
                id="edit-last"
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                placeholder="New last name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditSession(null)}
              className="border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={submitting}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold text-white shadow-lg shadow-violet-600/25"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPen className="mr-2 h-4 w-4" />
              )}
              Modify Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
