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
import { toast } from "sonner";
import { Loader2, RefreshCcw } from "lucide-react";

interface TgSessionRow {
  id: string;
  phone: string;
  tgUserId: string | null;
  tgFirstName: string | null;
  tgLastName: string | null;
  tgUsername: string | null;
  isAlive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

type Step = "idle" | "sending" | "code_sent" | "verifying" | "needs_2fa";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<TgSessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  // New session flow
  const [step, setStep] = useState<Step>("idle");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Import flow
  const [showImport, setShowImport] = useState(false);
  const [importPhone, setImportPhone] = useState("");
  const [importSession, setImportSession] = useState("");
  const [importing, setImporting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

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

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setStep("sending");

    const res = await fetch("/api/sessions/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      setError(data.error ?? "Failed to send code");
      setStep("idle");
      return;
    }
    setStep("code_sent");
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStep("verifying");

    const res = await fetch("/api/sessions/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code, password: password || undefined }),
    });
    const data = await res.json();

    if (data.needs2FA) {
      setStep("needs_2fa");
      return;
    }

    if (!res.ok || data.error) {
      setError(data.error ?? "Verification failed");
      setStep("code_sent");
      return;
    }

    setSuccessMsg(
      `Session created for ${data.tgUsername ?? data.tgFirstName ?? phone}`
    );
    setStep("idle");
    setPhone("");
    setCode("");
    setPassword("");
    fetchSessions();
  }

  async function handleDelete(sessionId: string) {
    await fetch("/api/sessions/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    fetchSessions();
  }

  async function handleClearDead() {
    await fetch("/api/sessions/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteAll: true }),
    });
    fetchSessions();
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setImporting(true);
    setError("");

    const res = await fetch("/api/sessions/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: importPhone,
        stringSession: importSession.trim(),
      }),
    });
    const data = await res.json();
    setImporting(false);

    if (!res.ok || data.error) {
      setError(data.error ?? "Import failed");
      return;
    }

    setSuccessMsg(`Imported session for ${data.tgUsername ?? importPhone}`);
    setImportPhone("");
    setImportSession("");
    setShowImport(false);
    fetchSessions();
  }

  async function handleTest(sessionId: string) {
    setTestingId(sessionId);
    try {
      const res = await fetch("/api/sessions/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(data.error ?? "Test failed");
      } else {
        if (data.isAlive) {
          toast.success("Session is alive!");
        } else {
          toast.error("Session is dead (unauthorized or revoked)");
        }
        fetchSessions();
      }
    } catch (err: any) {
      toast.error(err.message ?? "Connection error");
    } finally {
      setTestingId(null);
    }
  }

  const deadCount = sessions.filter((s) => !s.isAlive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Telegram Sessions</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImport(!showImport)}
            className="border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            Import
          </Button>
          <a href="/api/sessions/export" download>
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              Export
            </Button>
          </a>
          {deadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearDead}
              className="border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200"
            >
              Clear Dead ({deadCount})
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
          <button
            className="ml-2 text-red-400 underline hover:text-red-200"
            onClick={() => setError("")}
          >
            dismiss
          </button>
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {successMsg}
          <button
            className="ml-2 text-emerald-400 underline hover:text-emerald-200"
            onClick={() => setSuccessMsg("")}
          >
            dismiss
          </button>
        </div>
      )}

      {/* Import Card */}
      {showImport && (
        <Card className="border-white/5 bg-white/[0.03] backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg text-white">
              Import StringSession
            </CardTitle>
            <CardDescription>
              Paste an existing StringSession to add it to your pool.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleImport} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="import-phone">Phone</Label>
                <Input
                  id="import-phone"
                  placeholder="+1234567890"
                  value={importPhone}
                  onChange={(e) => setImportPhone(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="import-session">StringSession</Label>
                <textarea
                  id="import-session"
                  className="flex min-h-[80px] w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none"
                  placeholder="1BQANOTEuMTA4LjU2..."
                  value={importSession}
                  onChange={(e) => setImportSession(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={importing}>
                {importing ? "Validating..." : "Import Session"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* New Session Card */}
      <Card className="border-white/5 bg-white/[0.03] backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg text-white">
            Generate New Session
          </CardTitle>
          <CardDescription>
            Enter your phone number to receive a Telegram verification code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "idle" || step === "sending" ? (
            <form onSubmit={handleSendCode} className="flex gap-3">
              <Input
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="max-w-xs"
                required
              />
              <Button type="submit" disabled={step === "sending"}>
                {step === "sending" ? "Sending..." : "Send Code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-3">
              <p className="text-sm text-zinc-400">
                Code sent to{" "}
                <span className="font-medium text-white">{phone}</span>
              </p>
              <div className="flex gap-3">
                <Input
                  placeholder="12345"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="max-w-[160px]"
                  required
                />
                {step === "needs_2fa" && (
                  <Input
                    type="password"
                    placeholder="2FA Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="max-w-xs"
                    required
                  />
                )}
                <Button type="submit" disabled={step === "verifying"}>
                  {step === "verifying" ? "Verifying..." : "Verify"}
                </Button>
              </div>
              {step === "needs_2fa" && (
                <p className="text-sm text-amber-300">
                  Two-factor authentication required. Enter your 2FA password.
                </p>
              )}
              <button
                type="button"
                className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
                onClick={() => {
                  setStep("idle");
                  setCode("");
                  setPassword("");
                }}
              >
                Cancel
              </button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Session List */}
      <Card className="border-white/5 bg-white/[0.03] backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-lg text-white">Session Pool</CardTitle>
          <CardDescription>
            {sessions.length} session{sessions.length !== 1 ? "s" : ""}{" "}
            registered.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-zinc-500">Loading...</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No sessions yet. Generate or import one above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-zinc-400">
                    <th className="pb-2 pr-4">Phone</th>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Username</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Created</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="py-3 pr-4 font-mono text-xs text-zinc-300">
                        {s.phone}
                      </td>
                      <td className="py-3 pr-4 text-zinc-300">
                        {[s.tgFirstName, s.tgLastName]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </td>
                      <td className="py-3 pr-4 text-zinc-500">
                        {s.tgUsername ? `@${s.tgUsername}` : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-medium ${s.isAlive
                                ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                : "border border-zinc-500/20 bg-zinc-500/10 text-zinc-400"
                              }`}
                          >
                            {s.isAlive ? "Alive" : "Dead"}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-zinc-500 hover:text-white"
                            disabled={testingId === s.id}
                            onClick={() => handleTest(s.id)}
                            title="Test connection"
                          >
                            {testingId === s.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCcw className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-zinc-500">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(s.id)}
                          className="border-white/10 bg-white/5 text-zinc-300 hover:bg-red-500/10 hover:text-red-300"
                        >
                          Delete
                        </Button>
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
