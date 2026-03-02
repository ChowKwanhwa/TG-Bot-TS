import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSession } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await prisma.tgSession.findMany({
    where: { userId: session.user.id, isAlive: true },
    select: {
      phone: true,
      encryptedSession: true,
      sessionIv: true,
      sessionTag: true,
      tgFirstName: true,
      tgUsername: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const lines = sessions.map((s) => {
    const stringSession = decryptSession(
      s.encryptedSession,
      s.sessionIv,
      s.sessionTag
    );
    const label = s.tgUsername ?? s.tgFirstName ?? s.phone;
    return `# ${label} (${s.phone})\n${stringSession}`;
  });

  const text = lines.join("\n\n");

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="tg-sessions-${Date.now()}.txt"`,
    },
  });
}
