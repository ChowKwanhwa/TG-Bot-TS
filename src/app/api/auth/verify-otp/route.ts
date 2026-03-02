import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp-store";

export async function POST(req: Request) {
  const { email, code } = (await req.json()) as {
    email?: string;
    code?: string;
  };

  if (!email || !code) {
    return NextResponse.json(
      { error: "Email and code are required" },
      { status: 400 }
    );
  }

  const result = verifyOtp(email, code);

  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, authToken: result.authToken });
}
