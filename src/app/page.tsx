"use client";

import { signIn } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  Zap,
  Shield,
  Clock,
  MessageSquare,
  Users,
  Bot,
} from "lucide-react";

// ─── OTP Input Component ──────────────────────────────
function OtpInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(idx: number, char: string) {
    if (!/^\d?$/.test(char)) return;
    const arr = value.split("");
    arr[idx] = char;
    const next = arr.join("").slice(0, 6);
    onChange(next);
    if (char && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !value[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  }

  return (
    <div className="flex justify-center gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="h-14 w-12 rounded-xl border border-white/10 bg-white/5 text-center text-2xl font-bold text-white backdrop-blur-sm transition-all duration-300 focus:border-violet-500/60 focus:shadow-[0_0_20px_-3px_rgba(139,92,246,0.3)] focus:outline-none sm:h-16 sm:w-14"
        />
      ))}
    </div>
  );
}

// ─── Main Landing Content ─────────────────────────────
type FlowStep = "email" | "sending" | "otp" | "verifying";

function LandingContent() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<FlowStep>("email");
  const [otp, setOtp] = useState("");
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    trial_expired: "Your free trial has expired. Contact admin for access.",
    suspended: "Your account has been suspended.",
  };

  // Auto-submit when OTP is 6 digits
  useEffect(() => {
    if (otp.length === 6 && step === "otp") {
      handleVerifyOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStep("sending");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to send code");
        setStep("email");
        return;
      }
      setStep("otp");
    } catch {
      toast.error("Network error. Please try again.");
      setStep("email");
    }
  }

  async function handleVerifyOtp() {
    setStep("verifying");

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Verification failed");
        setStep("otp");
        setOtp("");
        return;
      }
      // OTP valid — sign in via NextAuth credentials with auth token
      await signIn("credentials", {
        email: email.trim(),
        authToken: data.authToken,
        callbackUrl: "/dashboard",
      });
    } catch {
      toast.error("Network error. Please try again.");
      setStep("otp");
      setOtp("");
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* ── Ambient Glow Background ──────────────────── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-60 -top-60 h-[500px] w-[500px] rounded-full bg-violet-600/15 blur-[150px]" />
        <div className="absolute -bottom-60 -right-60 h-[500px] w-[500px] rounded-full bg-fuchsia-600/15 blur-[150px]" />
        <div className="absolute left-1/3 top-1/4 h-72 w-72 rounded-full bg-violet-500/8 blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/3 h-64 w-64 rounded-full bg-fuchsia-400/6 blur-[100px]" />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ── Minimal Nav ──────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white shadow-lg shadow-violet-500/25">
            TG
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">
            RepeatBot
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const el = document.getElementById("cta");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-sm font-medium text-zinc-400 transition-colors duration-200 hover:text-white"
          >
            Log In
          </button>
          <Button
            onClick={() => {
              const el = document.getElementById("cta");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="hidden h-9 bg-white/10 text-xs font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20 sm:flex"
          >
            Sign Up
          </Button>
        </div>
      </nav>

      {/* ── Hero Section ─────────────────────────────── */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300">
            <Zap className="h-3.5 w-3.5" />
            Now with smart anti-detection jitter
          </div>

          {/* Main headline */}
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl lg:text-7xl">
            <span className="text-white">Automate Your</span>
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
              Telegram Communities
            </span>
            <br />
            <span className="text-white">10x Faster</span>
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-400 sm:text-xl">
            Manage sessions, scrape messages, and auto-chat across groups
            with human-like timing.{" "}
            <span className="text-zinc-300">No coding required.</span>
          </p>

          {/* ── Main Buttons ────────────────────────────── */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              onClick={() => {
                const el = document.getElementById("cta");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              size="lg"
              className="h-14 w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 text-base font-bold text-white shadow-xl shadow-violet-600/25 transition-all duration-300 hover:scale-[1.03] hover:shadow-violet-600/40 sm:w-auto"
            >
              Sign Up Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const el = document.getElementById("cta");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              size="lg"
              className="h-14 w-full border-white/10 bg-white/5 px-8 text-base font-bold text-white backdrop-blur-md transition-all duration-300 hover:bg-white/10 sm:w-auto"
            >
              Log In to Dashboard
            </Button>
          </div>

          {/* ── CTA Section ────────────────────────────── */}
          <div id="cta" className="mx-auto mt-16 max-w-md">
            {error && errorMessages[error] && (
              <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {errorMessages[error]}
              </div>
            )}

            {step === "email" || step === "sending" ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="group relative">
                  <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-violet-600/50 to-fuchsia-600/50 opacity-0 blur-sm transition-all duration-500 group-focus-within:opacity-100" />
                  <div className="relative flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/80 p-2 backdrop-blur-md">
                    <Input
                      type="email"
                      placeholder="Enter your email to start"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12 flex-1 border-0 bg-transparent px-4 text-base text-white placeholder:text-zinc-500 focus-visible:ring-0"
                    />
                    <Button
                      type="submit"
                      disabled={step === "sending"}
                      className="h-12 whitespace-nowrap rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 font-semibold text-white shadow-lg shadow-violet-600/25 transition-all duration-300 hover:scale-[1.03] hover:shadow-violet-600/40 disabled:opacity-60"
                    >
                      {step === "sending" ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Sending...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          Continue
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
                <p className="mt-4 text-center text-xs text-zinc-500">
                  3-hour free trial. No credit card required.
                </p>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-8 backdrop-blur-md">
                  <p className="mb-1 text-sm text-zinc-400">
                    Verification code sent to
                  </p>
                  <p className="mb-6 font-medium text-white">{email}</p>

                  <OtpInput value={otp} onChange={setOtp} />

                  {step === "verifying" && (
                    <div className="mt-6 flex items-center justify-center gap-2 text-sm text-violet-300">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
                      Verifying...
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                  }}
                  className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  Use a different email
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Feature Pills ──────────────────────────── */}
        <div className="mx-auto mt-20 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              icon: Shield,
              title: "Session Encryption",
              desc: "AES-256-GCM encrypted, zero local files",
            },
            {
              icon: MessageSquare,
              title: "Smart Scraping",
              desc: "FloodWait handling, media extraction",
            },
            {
              icon: Clock,
              title: "Human-like Timing",
              desc: "Configurable jitter between 2-60s",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]"
            >
              <f.icon className="mb-3 h-5 w-5 text-violet-400 transition-transform duration-300 group-hover:scale-110" />
              <h3 className="text-sm font-semibold text-white">{f.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* ── Social proof row ───────────────────────── */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-zinc-500">
          {[
            { icon: Users, label: "500+ Active Users" },
            { icon: Bot, label: "1M+ Messages Sent" },
            { icon: Zap, label: "99.9% Uptime" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-sm">
              <s.icon className="h-4 w-4 text-zinc-600" />
              {s.label}
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-6 text-center text-xs text-zinc-600">
        TG RepeatBot &middot; Stateless SaaS Architecture
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={null}>
      <LandingContent />
    </Suspense>
  );
}
