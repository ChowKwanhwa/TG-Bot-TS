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
import { MessageSquareText, Loader2, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";

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

export default function MsgScraperPage() {
  const [sessions, setSessions] = useState<TgSessionOption[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingZip, setDownloadingZip] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState("");
  const [link, setLink] = useState("");
  const [count, setCount] = useState("20");
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
      setTasks(
        data.tasks.filter((t: TaskRow) => t.type === "MESSAGE_SCRAPE")
      );
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
      toast.error("Please enter a group link");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/tasks/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tgSessionId: sessionId,
        type: "MESSAGE_SCRAPE",
        config: { targetLink: link, messageCount: Number(count) },
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok || data.error) {
      toast.error(data.error ?? "Failed to create task");
      return;
    }
    toast.success("Scraping task created");
    fetchData();
  }

  async function cancelTask(taskId: string) {
    await fetch("/api/tasks/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    fetchData();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquareText className="h-6 w-6 text-fuchsia-400" />
        <h2 className="text-2xl font-bold text-white">Message Scraper</h2>
      </div>

      {/* Scraper Form */}
      <Card className="border-white/5 bg-white/[0.03] backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg text-white">
            Scrape Messages
          </CardTitle>
          <CardDescription>
            Scrape recent messages from a Telegram group. Media files will be
            extracted and catalogued.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="sc-session">Session</Label>
              <select
                id="sc-session"
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
              <Label htmlFor="sc-link">Group Link</Label>
              <Input
                id="sc-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://t.me/OneEx_CN"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-count">Message Count</Label>
              <Input
                id="sc-count"
                type="number"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                min={1}
                max={500}
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
              <MessageSquareText className="mr-2 h-4 w-4" />
            )}
            Start Scraping
          </Button>
        </CardContent>
      </Card>

      {/* Scrape History */}
      <Card className="border-white/5 bg-white/[0.03] backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-white">
                Scrape History
              </CardTitle>
              <CardDescription>
                Past scraping tasks and their results.
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
            <p className="text-sm text-zinc-500">
              No scraping tasks yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-zinc-400">
                    <th className="pb-2 pr-3">Session</th>
                    <th className="pb-2 pr-3">Target</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Result</th>
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
                      <td className="max-w-[200px] truncate py-2 pr-3 text-xs text-zinc-500">
                        {t.status === "RUNNING" && t.result && (t.result as any).progress !== undefined && (
                          <div className="flex flex-col gap-1 w-32">
                            <div className="flex justify-between text-[10px] text-zinc-400">
                              <span>{(t.result as any).fetched ?? 0}/{(t.result as any).total ?? 0}</span>
                              <span className="text-blue-400 font-medium">{(t.result as any).progress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                style={{ width: `${(t.result as any).progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {t.status === "COMPLETED" && t.result
                          ? `${(t.result as Record<string, unknown>).totalMessages ?? 0} msgs`
                          : t.status !== "RUNNING" ? "—" : null}
                      </td>
                      <td className="py-2 pr-3 text-xs text-zinc-500">
                        {new Date(t.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 gap-2 flex flex-wrap">
                        {t.status === "COMPLETED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const res = t.result as any;
                              if (!res || !res.messages) {
                                toast.error("No data found to export.");
                                return;
                              }
                              const headers = ["ID", "Text", "Media Type", "Media URL", "Date"];
                              const rows = res.messages.map((m: any) => [
                                m.msgId,
                                `"${(m.text || "").replace(/"/g, '""')}"`,
                                m.mediaType || "",
                                m.mediaUrl || "",
                                m.date
                              ]);
                              const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                              const link = document.createElement("a");
                              const url = URL.createObjectURL(blob);
                              link.setAttribute("href", url);
                              link.setAttribute("download", `scrape_${t.id}.csv`);
                              link.style.visibility = 'hidden';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="border-blue-500/20 bg-blue-500/10 text-xs text-blue-300 hover:bg-blue-500/20 hover:text-blue-200"
                          >
                            Export CSV
                          </Button>
                        )}
                        {t.status === "COMPLETED" && t.result && (t.result as any).messages && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={downloadingZip === t.id}
                            onClick={async () => {
                              const res = t.result as any;
                              const mediaMessages = res.messages.filter((m: any) => m.mediaUrl);
                              if (mediaMessages.length === 0) {
                                toast.error("No media files found in this scrape.");
                                return;
                              }

                              setDownloadingZip(t.id);
                              try {
                                const zip = new JSZip();
                                toast.info(`Starting download of ${mediaMessages.length} files...`);

                                for (let i = 0; i < mediaMessages.length; i++) {
                                  const m = mediaMessages[i];
                                  const response = await fetch(m.mediaUrl);
                                  if (!response.ok) continue;
                                  const blob = await response.blob();

                                  // Determine filename
                                  let filename = `${m.msgId}`;
                                  if (m.mediaType === "photo") filename += ".jpg";
                                  else if (m.mediaType === "document") filename += ".bin";

                                  zip.file(filename, blob);
                                }

                                const content = await zip.generateAsync({ type: "blob" });
                                const link = document.createElement("a");
                                link.href = URL.createObjectURL(content);
                                link.download = `media_${t.id}.zip`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                toast.success("Media ZIP downloaded!");
                              } catch (err) {
                                console.error("Zip error:", err);
                                toast.error("Failed to generate ZIP.");
                              } finally {
                                setDownloadingZip(null);
                              }
                            }}
                            className="border-fuchsia-500/20 bg-fuchsia-500/10 text-xs text-fuchsia-300 hover:bg-fuchsia-500/20 hover:text-fuchsia-200"
                          >
                            {downloadingZip === t.id ? (
                              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="mr-1.5 h-3 w-3" />
                            )}
                            Download media folder (Zip)
                          </Button>
                        )}
                        {(t.status === "PENDING" ||
                          t.status === "RUNNING") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelTask(t.id)}
                              className="border-red-500/20 bg-red-500/10 text-xs text-red-300 hover:bg-red-500/20 hover:text-red-200"
                            >
                              Cancel
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
