"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Bot, Loader2, RefreshCw, StopCircle } from "lucide-react";
import { toast } from "sonner";

interface TgSessionOption {
  id: string;
  phone: string;
  tgUsername: string | null;
  tgFirstName: string | null;
}

interface TaskRow {
  id: string;
  type: string;
  status: string;
  config: Record<string, unknown>;
  result: Record<string, unknown> | null;
  createdAt: string;
  completedAt: string | null;
  tgSession: {
    phone: string;
    tgUsername: string | null;
    tgFirstName: string | null;
  };
}

const statusBadge: Record<string, string> = {
  PENDING: "border border-amber-500/20 bg-amber-500/10 text-amber-300",
  RUNNING: "border border-blue-500/20 bg-blue-500/10 text-blue-300",
  COMPLETED: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  FAILED: "border border-red-500/20 bg-red-500/10 text-red-300",
  CANCELLED: "border border-zinc-500/20 bg-zinc-500/10 text-zinc-400",
};

export default function AutoChatPage() {
  const [sessions, setSessions] = useState<TgSessionOption[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [sessionId, setSessionId] = useState("");
  const [link, setLink] = useState("");
  const [messages, setMessages] = useState("");
  const [minDelay, setMinDelay] = useState("2");
  const [maxDelay, setMaxDelay] = useState("5");
  const [maxIter, setMaxIter] = useState("100");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [sessRes, taskRes] = await Promise.all([
      fetch("/api/sessions/list"),
      fetch("/api/tasks/list"),
    ]);
    if (sessRes.ok) {
      const data = await sessRes.json();
      setSessions(
        data.sessions.filter((s: { isAlive: boolean }) => s.isAlive)
      );
    }
    if (taskRes.ok) {
      const data = await taskRes.json();
      setTasks(data.tasks.filter((t: TaskRow) => t.type === "AUTO_CHAT"));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSubmit() {
    if (!sessionId) {
      toast.error("Please select a session");
      return;
    }
    if (!link.trim()) {
      toast.error("Please enter a target link");
      return;
    }
    const msgs = messages
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (msgs.length === 0) {
      toast.error("Please add at least one message");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/tasks/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tgSessionId: sessionId,
        type: "AUTO_CHAT",
        config: {
          targetLink: link,
          messages: msgs,
          minDelaySec: Number(minDelay),
          maxDelaySec: Number(maxDelay),
          maxIterations: Number(maxIter),
        },
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok || data.error) {
      toast.error(data.error ?? "Failed to create task");
      return;
    }
    toast.success("Auto chat task created");
    fetchData();
  }

  async function cancelTask(taskId: string) {
    await fetch("/api/tasks/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    toast.success("Task cancelled");
    fetchData();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-emerald-400" />
        <h2 className="text-2xl font-bold text-white">Auto Chat</h2>
      </div>

      {/* Auto Chat Form */}
      <Card className="border-white/5 bg-white/[0.03] backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg text-white">
            Configure Auto Chat
          </CardTitle>
          <CardDescription>
            Send messages to a Telegram group with jitter delay. Supports Topic
            groups (append /topicId to the link).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ac-session">Session</Label>
              <select
                id="ac-session"
                className="flex h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors focus:border-violet-500/50 focus:outline-none"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              >
                <option value="" className="bg-zinc-900">
                  Select a session...
                </option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id} className="bg-zinc-900">
                    {s.tgUsername
                      ? `@${s.tgUsername}`
                      : s.tgFirstName ?? s.phone}{" "}
                    ({s.phone})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ac-link">Target Link</Label>
              <Input
                id="ac-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://t.me/BingXOfficial/1"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ac-messages">Messages (one per line)</Label>
            <textarea
              id="ac-messages"
              className="flex min-h-[100px] w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none"
              value={messages}
              onChange={(e) => setMessages(e.target.value)}
              placeholder={"Hello!\nHow are you?\nGood morning!"}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ac-min">Min Delay (s)</Label>
              <Input
                id="ac-min"
                type="number"
                value={minDelay}
                onChange={(e) => setMinDelay(e.target.value)}
                min={1}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ac-max">Max Delay (s)</Label>
              <Input
                id="ac-max"
                type="number"
                value={maxDelay}
                onChange={(e) => setMaxDelay(e.target.value)}
                min={1}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ac-iter">Max Iterations</Label>
              <Input
                id="ac-iter"
                type="number"
                value={maxIter}
                onChange={(e) => setMaxIter(e.target.value)}
                min={1}
              />
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold text-white shadow-lg shadow-violet-600/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-violet-600/40"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Bot className="mr-2 h-4 w-4" />
            )}
            Start Auto Chat
          </Button>
        </CardContent>
      </Card>

      {/* Task History */}
      <Card className="border-white/5 bg-white/[0.03] backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-white">
                Chat History
              </CardTitle>
              <CardDescription>
                Auto chat tasks and their status.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              className="border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-zinc-500">No auto chat tasks yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-zinc-400">
                    <th className="pb-2 pr-3">Session</th>
                    <th className="pb-2 pr-3">Target</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Sent</th>
                    <th className="pb-2 pr-3">Created</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="py-2 pr-3 text-xs text-zinc-300">
                        {t.tgSession.tgUsername
                          ? `@${t.tgSession.tgUsername}`
                          : t.tgSession.phone}
                      </td>
                      <td className="py-2 pr-3 text-xs text-zinc-400">
                        {(t.config.targetLink as string) ?? "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusBadge[t.status] ?? ""}`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-xs text-zinc-400">
                        {t.result
                          ? `${(t.result as Record<string, unknown>).messagesSent ?? 0} msgs`
                          : "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs text-zinc-500">
                        {new Date(t.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2">
                        {(t.status === "PENDING" ||
                          t.status === "RUNNING") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelTask(t.id)}
                            className="border-red-500/20 bg-red-500/10 text-xs text-red-300 hover:bg-red-500/20 hover:text-red-200"
                          >
                            <StopCircle className="mr-1 h-3 w-3" />
                            Stop
                          </Button>
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
