import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Shield,
  Radio,
  ListTodo,
  UserPen,
  MessageSquareText,
  Bot,
} from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const role = (session?.user as Record<string, unknown>)?.role as string;

  const [sessionCount, taskCount] = await Promise.all([
    prisma.tgSession.count({ where: { userId, isAlive: true } }),
    prisma.botTask.count({
      where: { userId, status: { in: ["PENDING", "RUNNING"] } },
    }),
  ]);

  const statCards = [
    {
      icon: Radio,
      title: "Sessions",
      desc: "Active Telegram sessions",
      value: sessionCount.toString(),
      color: "text-violet-400",
    },
    {
      icon: ListTodo,
      title: "Tasks",
      desc: "Running automation tasks",
      value: taskCount.toString(),
      color: "text-fuchsia-400",
    },
    {
      icon: Shield,
      title: "Role",
      desc: "Your account status",
      value: role ?? "Unknown",
      color: "text-emerald-400",
    },
  ];

  const toolCards = [
    {
      icon: UserPen,
      title: "Profile Modifier",
      desc: "Edit Telegram profile names for your sessions",
      href: "/dashboard/profile-modifier",
      color: "text-violet-400",
      gradient: "from-violet-600 to-fuchsia-600",
    },
    {
      icon: MessageSquareText,
      title: "Message Scraper",
      desc: "Scrape messages and media from Telegram groups",
      href: "/dashboard/msg-scraper",
      color: "text-fuchsia-400",
      gradient: "from-fuchsia-600 to-pink-600",
    },
    {
      icon: Bot,
      title: "Auto Chat",
      desc: "Send automated messages with jitter delay",
      href: "/dashboard/auto-chat",
      color: "text-emerald-400",
      gradient: "from-emerald-600 to-teal-600",
    },
  ];

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-white">Dashboard</h2>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((c) => (
          <Card
            key={c.title}
            className="group border-white/5 bg-white/[0.03] backdrop-blur-sm transition-all duration-300 hover:border-white/10 hover:bg-white/[0.06]"
          >
            <CardHeader>
              <c.icon
                className={`mb-1 h-5 w-5 ${c.color} transition-transform duration-300 group-hover:scale-110`}
              />
              <CardTitle className="text-white">{c.title}</CardTitle>
              <CardDescription>{c.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Access Tools */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-zinc-300">Tools</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {toolCards.map((t) => (
            <Link key={t.title} href={t.href}>
              <Card className="group cursor-pointer border-white/5 bg-white/[0.03] backdrop-blur-sm transition-all duration-300 hover:border-white/10 hover:bg-white/[0.06]">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${t.gradient} shadow-lg`}
                    >
                      <t.icon className="h-4.5 w-4.5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base text-white">
                        {t.title}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {t.desc}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
