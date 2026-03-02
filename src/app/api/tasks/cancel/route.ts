import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBotQueue } from "@/lib/queue";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = (await req.json()) as { taskId?: string };
  if (!taskId) {
    return NextResponse.json(
      { error: "taskId is required" },
      { status: 400 }
    );
  }

  // Verify ownership
  const task = await prisma.botTask.findFirst({
    where: { id: taskId, userId: session.user.id },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status === "COMPLETED" || task.status === "CANCELLED") {
    return NextResponse.json({ error: "Task already finished" }, { status: 400 });
  }

  // Mark as cancelled in DB (worker checks this)
  await prisma.botTask.update({
    where: { id: taskId },
    data: { status: "CANCELLED", completedAt: new Date() },
  });

  // Try to remove from queue if still pending
  try {
    const queue = getBotQueue();
    const job = await queue.getJob(taskId);
    if (job) {
      await job.remove();
    }
  } catch {
    // Job may already be processing — worker will pick up CANCELLED status
  }

  return NextResponse.json({ success: true });
}
