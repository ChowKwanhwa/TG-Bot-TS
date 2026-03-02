import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBotQueue } from "@/lib/queue";
import type { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { tgSessionId, type, config } = body as {
    tgSessionId: string;
    type: "PROFILE_MODIFY" | "MESSAGE_SCRAPE" | "AUTO_CHAT";
    config: Record<string, unknown>;
  };

  if (!tgSessionId || !type || !config) {
    return NextResponse.json(
      { error: "tgSessionId, type, and config are required" },
      { status: 400 }
    );
  }

  // Verify session ownership
  const tgSession = await prisma.tgSession.findFirst({
    where: { id: tgSessionId, userId: session.user.id, isAlive: true },
  });

  if (!tgSession) {
    return NextResponse.json(
      { error: "Session not found or not alive" },
      { status: 404 }
    );
  }

  // Create task record
  const task = await prisma.botTask.create({
    data: {
      userId: session.user.id,
      tgSessionId,
      type,
      config: config as Prisma.InputJsonValue,
    },
  });

  // Enqueue to BullMQ
  const queue = getBotQueue();
  await queue.add(
    type,
    {
      taskId: task.id,
      tgSessionId,
      type,
      config,
    },
    {
      jobId: task.id,
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86400 },
    }
  );

  return NextResponse.json({ taskId: task.id, status: "PENDING" });
}
