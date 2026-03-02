import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSession } from "@/lib/crypto";
import { createTgClient } from "@/lib/tg-client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { phone, stringSession } = (await req.json()) as {
    phone?: string;
    stringSession?: string;
  };

  if (!phone || !stringSession) {
    return NextResponse.json(
      { error: "phone and stringSession are required" },
      { status: 400 }
    );
  }

  if (!/^\+\d{7,15}$/.test(phone)) {
    return NextResponse.json(
      { error: "Invalid phone number format" },
      { status: 400 }
    );
  }

  // Validate the session by connecting briefly
  try {
    const client = createTgClient(stringSession);
    await client.connect();
    const me = await client.getMe();
    await client.disconnect();

    const encrypted = encryptSession(stringSession);

    const user = me as {
      id?: { toString(): string };
      firstName?: string;
      lastName?: string;
      username?: string;
    };

    await prisma.tgSession.upsert({
      where: {
        userId_phone: { userId: session.user.id, phone },
      },
      create: {
        userId: session.user.id,
        phone,
        encryptedSession: encrypted.ciphertext,
        sessionIv: encrypted.iv,
        sessionTag: encrypted.tag,
        tgUserId: user.id ? BigInt(user.id.toString()) : null,
        tgFirstName: user.firstName ?? null,
        tgLastName: user.lastName ?? null,
        tgUsername: user.username ?? null,
      },
      update: {
        encryptedSession: encrypted.ciphertext,
        sessionIv: encrypted.iv,
        sessionTag: encrypted.tag,
        tgUserId: user.id ? BigInt(user.id.toString()) : null,
        tgFirstName: user.firstName ?? null,
        tgLastName: user.lastName ?? null,
        tgUsername: user.username ?? null,
        isAlive: true,
      },
    });

    return NextResponse.json({ success: true, tgUsername: user.username });
  } catch (err: unknown) {
    const error = err as { message?: string };
    return NextResponse.json(
      { error: error.message ?? "Invalid or expired session" },
      { status: 400 }
    );
  }
}
