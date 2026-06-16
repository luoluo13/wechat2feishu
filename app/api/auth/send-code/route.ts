import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { z } from "zod";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";

const sendCodeSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = sendCodeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email } = result.data;

    // Generate 6-digit code
    const code = randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save to DB
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: code,
        expires,
        type: "EMAIL_REGISTER",
      },
    });

    // Send Email or Log
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 465,
                secure: true, // true for 465 (SSL), false for other ports (TLS)
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            await transporter.sendMail({
                from: `"Wechat2doc" <${process.env.SMTP_USER}>`,
                to: email,
                subject: "您的 Wechat2doc 登录验证码",
                html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #eaeaea; border-radius: 12px; text-align: center;">
                        <h2 style="color: #1d1d1f; margin-bottom: 24px;">Wechat2doc</h2>
                        <p style="font-size: 16px; color: #1d1d1f; margin-bottom: 32px;">验证码用于登录或注册您的账号。</p>
                        <div style="background-color: #f5f5f7; padding: 20px; border-radius: 12px; margin-bottom: 32px; display: inline-block;">
                            <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1d1d1f;">${code}</span>
                        </div>
                        <p style="font-size: 14px; color: #86868b;">该验证码将在 5 分钟后失效。</p>
                    </div>
                `,
            });
            console.log(`[SMTP] Sent verification code to ${email}`);
        } catch (emailError: any) {
            console.error("[SMTP Error]", emailError);
            // Fallback to log if email fails
            console.log(`[DEV] Verification Code for ${email}: ${code}`);
        }
    } else {
        // Fallback: Print to console (Dev / No SMTP Config)
        console.log(`[DEV] Verification Code for ${email}: ${code}`);
    }

    return NextResponse.json({ message: "Verification code sent" });
  } catch (error) {
    console.error("Send code error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
