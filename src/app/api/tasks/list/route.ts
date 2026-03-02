import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await prisma.botTask.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      type: true,
      status: true,
      config: true,
      result: true,
      createdAt: true,
      completedAt: true,
      tgSession: {
        select: {
          phone: true,
          tgUsername: true,
          tgFirstName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ tasks });
}
