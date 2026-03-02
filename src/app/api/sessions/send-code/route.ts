import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTgClient, setPendingLogin } from "@/lib/tg-client";
import { Api } from "telegram";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { phone } = (await req.json()) as { phone?: string };
  if (!phone || !/^\+\d{7,15}$/.test(phone)) {
    return NextResponse.json(
      { error: "Invalid phone number. Use format: +1234567890" },
      { status: 400 }
    );
  }

  try {
    const client = createTgClient();
    await client.connect();

    const result = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber: phone,
        apiId: Number(process.env.API_ID),
        apiHash: process.env.API_HASH!,
        settings: new Api.CodeSettings({}),
      })
    );

    if (!("phoneCodeHash" in result) || !result.phoneCodeHash) {
      return NextResponse.json(
        { error: "Unexpected response from Telegram" },
        { status: 500 }
      );
    }
    const phoneCodeHash = result.phoneCodeHash;
    setPendingLogin(session.user.id, phone, client, phoneCodeHash);

    return NextResponse.json({
      success: true,
      phoneCodeHash,
      message: "Verification code sent",
    });
  } catch (err: unknown) {
    const error = err as { message?: string; errorMessage?: string };
    const msg = error.errorMessage ?? error.message ?? "Failed to send code";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
