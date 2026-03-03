import { NextResponse } from "next/server";
import { Resend } from "resend";
import { generateOtp, storeOtp } from "@/lib/otp-store";

const FROM_EMAIL = process.env.OTP_FROM_EMAIL ?? "onboarding@resend.dev";

export async function POST(req: Request) {
  const { email } = (await req.json()) as { email?: string };

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 }
    );
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const code = generateOtp();
  storeOtp(email, code);

  if (process.env.NODE_ENV !== "production") {
    console.log(`[send-otp] DEV code for ${email}: ${code}`);
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Your TG RepeatBot verification code: ${code}`,
      html: `
        <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #0c0a14; color: #e4e4e7;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; width: 40px; height: 40px; line-height: 40px; border-radius: 10px; background: linear-gradient(135deg, #7c3aed, #c026d3); color: white; font-weight: bold; font-size: 14px;">TG</div>
          </div>
          <h2 style="text-align: center; font-size: 20px; font-weight: 600; margin: 0 0 8px;">Verification Code</h2>
          <p style="text-align: center; color: #a1a1aa; font-size: 14px; margin: 0 0 32px;">Enter this code to sign in to TG RepeatBot</p>
          <div style="text-align: center; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: white; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
            ${code}
          </div>
          <p style="text-align: center; color: #71717a; font-size: 12px; margin-top: 24px;">This code expires in 5 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("[send-otp] Resend error:", error);
      return NextResponse.json(
        { error: "Failed to send email. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[send-otp] Exception:", err);
    return NextResponse.json(
      { error: "Failed to send email." },
      { status: 500 }
    );
  }
}
