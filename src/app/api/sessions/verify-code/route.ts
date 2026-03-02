import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPendingLogin, removePendingLogin } from "@/lib/tg-client";
import { encryptSession } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { Api } from "telegram";
import { StringSession } from "telegram/sessions";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { phone, code, password } = (await req.json()) as {
    phone?: string;
    code?: string;
    password?: string;
  };

  if (!phone || !code) {
    return NextResponse.json(
      { error: "Phone and code are required" },
      { status: 400 }
    );
  }

  const pending = getPendingLogin(session.user.id, phone);
  if (!pending) {
    return NextResponse.json(
      { error: "No pending login. Please request a new code." },
      { status: 400 }
    );
  }

  const { client, phoneCodeHash } = pending;

  try {
    let signInResult;
    try {
      signInResult = await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: phone,
          phoneCodeHash,
          phoneCode: code,
        })
      );
    } catch (err: unknown) {
      const error = err as { errorMessage?: string };
      // 2FA required
      if (error.errorMessage === "SESSION_PASSWORD_NEEDED") {
        if (!password) {
          return NextResponse.json(
            { error: "2FA_REQUIRED", needs2FA: true },
            { status: 200 }
          );
        }
        const passwordResult = await client.invoke(
          new Api.account.GetPassword()
        );
        const { computeCheck } = await import("telegram/Password");
        const srpResult = await computeCheck(passwordResult, password);
        signInResult = await client.invoke(
          new Api.auth.CheckPassword({ password: srpResult })
        );
      } else {
        throw err;
      }
    }

    // Extract user info
    let tgUserId: bigint | undefined;
    let tgFirstName: string | undefined;
    let tgLastName: string | undefined;
    let tgUsername: string | undefined;

    if (signInResult && "user" in signInResult && signInResult.user) {
      const user = signInResult.user as Api.User;
      tgUserId = user.id ? BigInt(user.id.toString()) : undefined;
      tgFirstName = user.firstName ?? undefined;
      tgLastName = user.lastName ?? undefined;
      tgUsername = user.username ?? undefined;
    }

    // Get the StringSession
    const stringSession = (client.session as StringSession).save();

    // Encrypt and store
    const encrypted = encryptSession(stringSession);

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
        tgUserId: tgUserId ?? null,
        tgFirstName: tgFirstName ?? null,
        tgLastName: tgLastName ?? null,
        tgUsername: tgUsername ?? null,
      },
      update: {
        encryptedSession: encrypted.ciphertext,
        sessionIv: encrypted.iv,
        sessionTag: encrypted.tag,
        tgUserId: tgUserId ?? null,
        tgFirstName: tgFirstName ?? null,
        tgLastName: tgLastName ?? null,
        tgUsername: tgUsername ?? null,
        isAlive: true,
      },
    });

    removePendingLogin(session.user.id, phone);

    return NextResponse.json({
      success: true,
      tgUserId: tgUserId?.toString() ?? null,
      tgFirstName: tgFirstName ?? null,
      tgUsername: tgUsername ?? null,
    });
  } catch (err: unknown) {
    const error = err as { message?: string; errorMessage?: string };
    const msg =
      error.errorMessage ?? error.message ?? "Verification failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
