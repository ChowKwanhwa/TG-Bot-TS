import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SUPER_ADMIN_EMAIL } from "@/lib/constants";

async function assertSuperAdmin() {
  const session = await auth();
  if (session?.user?.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return null;
  }
  return session;
}

export async function GET() {
  if (!(await assertSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [users, stats] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        trialExpiresAt: true,
        createdAt: true,
        _count: { select: { tgSessions: true, tasks: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    Promise.all([
      prisma.user.count(),
      prisma.tgSession.count({ where: { isAlive: true } }),
      prisma.botTask.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
    ]),
  ]);

  return NextResponse.json({
    users,
    stats: {
      totalUsers: stats[0],
      aliveSessions: stats[1],
      activeTasks: stats[2],
    },
  });
}

export async function PATCH(req: Request) {
  if (!(await assertSuperAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, action } = body as {
    userId: string;
    action: "activate" | "suspend" | "extend_trial";
  };

  if (!userId || !action) {
    return NextResponse.json({ error: "Missing userId or action" }, { status: 400 });
  }

  switch (action) {
    case "activate": {
      await prisma.user.update({
        where: { id: userId },
        data: { role: "ACTIVE", trialExpiresAt: null },
      });
      break;
    }
    case "suspend": {
      await prisma.user.update({
        where: { id: userId },
        data: { role: "SUSPENDED" },
      });
      break;
    }
    case "extend_trial": {
      await prisma.user.update({
        where: { id: userId },
        data: {
          role: "TRIAL",
          trialExpiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
        },
      });
      break;
    }
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
