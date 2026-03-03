export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SUPER_ADMIN_EMAIL } from "@/lib/constants";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { UserPen, MessageSquareText, Bot, Radio } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  // Fresh role/trial check from DB (runs in Node.js Server Component, not Edge)
  const userId = (session.user as Record<string, unknown>).id as
    | string
    | undefined;
  if (userId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, trialExpiresAt: true },
    });
    if (dbUser) {
      if (dbUser.role === "SUSPENDED") {
        redirect("/?error=suspended");
      }
      if (
        dbUser.role === "TRIAL" &&
        dbUser.trialExpiresAt &&
        dbUser.trialExpiresAt.getTime() < Date.now()
      ) {
        redirect("/?error=trial_expired");
      }
    }
  }

  const isAdmin =
    session.user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-fuchsia-600/10 blur-[120px]" />
      </div>

      <header className="glass sticky top-0 z-50 border-b border-white/5">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white shadow-lg shadow-violet-500/25">
                TG
              </div>
              <span className="text-sm font-semibold tracking-tight text-white">
                RepeatBot
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-1.5 text-zinc-400 transition-all duration-200 hover:bg-white/5 hover:text-white"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/sessions"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-zinc-400 transition-all duration-200 hover:bg-white/5 hover:text-white"
              >
                <Radio className="h-3.5 w-3.5" />
                Sessions
              </Link>
              <Link
                href="/dashboard/profile-modifier"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-zinc-400 transition-all duration-200 hover:bg-white/5 hover:text-white"
              >
                <UserPen className="h-3.5 w-3.5" />
                Profile
              </Link>
              <Link
                href="/dashboard/msg-scraper"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-zinc-400 transition-all duration-200 hover:bg-white/5 hover:text-white"
              >
                <MessageSquareText className="h-3.5 w-3.5" />
                Scraper
              </Link>
              <Link
                href="/dashboard/auto-chat"
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-zinc-400 transition-all duration-200 hover:bg-white/5 hover:text-white"
              >
                <Bot className="h-3.5 w-3.5" />
                Auto Chat
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-lg px-3 py-1.5 text-red-400 transition-all duration-200 hover:bg-red-500/10 hover:text-red-300"
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">{session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
