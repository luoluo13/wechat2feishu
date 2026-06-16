
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  code: z.string().length(6, "Code must be 6 digits"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid input", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password, code } = result.data;

    // 1. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    // 2. Validate Verification Code
    // Find the latest valid token for this email and code
    const validToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: email,
        token: code,
        type: "EMAIL_REGISTER",
        expires: { gt: new Date() }, // Must not be expired
      },
      orderBy: { createdAt: "desc" },
    });

    if (!validToken) {
      // Optional: Check if an expired token exists to give better error
      return NextResponse.json(
        { error: "Invalid or expired verification code" },
        { status: 400 }
      );
    }

    // 3. Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create User
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        emailVerified: new Date(),
        name: email.split("@")[0], // Default name
      },
    });

    // 5. Cleanup used token (optional but recommended)
    // We might also want to delete all tokens for this email to clean up
    await prisma.verificationToken.deleteMany({
      where: { identifier: email, type: "EMAIL_REGISTER" },
    });

    return NextResponse.json({
      message: "User registered successfully",
      userId: newUser.id,
    });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
