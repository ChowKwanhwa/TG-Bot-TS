import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { decryptSession } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = (await req.json()) as { sessionId?: string };

    if (!sessionId) {
        return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const tgSession = await prisma.tgSession.findUnique({
        where: { id: sessionId },
    });

    if (!tgSession || tgSession.userId !== session.user.id) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    try {
        const sessionString = decryptSession(
            tgSession.encryptedSession,
            tgSession.sessionIv,
            tgSession.sessionTag
        );

        const client = new TelegramClient(
            new StringSession(sessionString),
            Number(process.env.API_ID),
            process.env.API_HASH!,
            { connectionRetries: 1 }
        );

        await client.connect();
        const authorized = await client.isUserAuthorized();

        await client.disconnect();

        // Update status in DB
        await prisma.tgSession.update({
            where: { id: sessionId },
            data: { isAlive: authorized, lastUsedAt: new Date() },
        });

        return NextResponse.json({
            success: true,
            isAlive: authorized,
        });
    } catch (err: unknown) {
        const error = err as { message?: string; errorMessage?: string };
        const msg = error.errorMessage ?? error.message ?? "Test failed";

        // If it's a known auth error, mark as dead
        if (msg.includes("AUTH_KEY_UNREGISTERED") || msg.includes("SESSION_REVOKED")) {
            await prisma.tgSession.update({
                where: { id: sessionId },
                data: { isAlive: false },
            });
            return NextResponse.json({ success: true, isAlive: false });
        }

        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
