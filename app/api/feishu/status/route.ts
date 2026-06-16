import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      avatarUrl: true,
      encryptedAccessToken: true,
      encryptedRefreshToken: true,
      feishuUserId: true,
      name: true,
      tokenExpiry: true,
    },
  });

  const connected = Boolean(
    user?.feishuUserId &&
      user?.encryptedAccessToken &&
      user?.encryptedRefreshToken
  );

  return NextResponse.json({
    connected,
    avatarUrl: user?.avatarUrl ?? null,
    displayName: user?.name ?? null,
    feishuUserId: user?.feishuUserId ?? null,
    tokenExpiry: user?.tokenExpiry?.toISOString() ?? null,
  });
}
