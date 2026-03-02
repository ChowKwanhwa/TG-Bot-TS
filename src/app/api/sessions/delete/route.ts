import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId, deleteAll } = (await req.json()) as {
    sessionId?: string;
    deleteAll?: boolean;
  };

  if (deleteAll) {
    // Delete all dead sessions
    const result = await prisma.tgSession.deleteMany({
      where: { userId: session.user.id, isAlive: false },
    });
    return NextResponse.json({ deleted: result.count });
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 }
    );
  }

  // Verify ownership before deletion
  const tgSession = await prisma.tgSession.findFirst({
    where: { id: sessionId, userId: session.user.id },
  });

  if (!tgSession) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await prisma.tgSession.delete({ where: { id: sessionId } });

  return NextResponse.json({ success: true });
}
