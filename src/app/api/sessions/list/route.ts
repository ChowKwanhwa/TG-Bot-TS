import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await prisma.tgSession.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      phone: true,
      tgUserId: true,
      tgFirstName: true,
      tgLastName: true,
      tgUsername: true,
      isAlive: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Convert BigInt to string for JSON serialization
  const serialized = sessions.map((s) => ({
    ...s,
    tgUserId: s.tgUserId?.toString() ?? null,
  }));

  return NextResponse.json({ sessions: serialized });
}
