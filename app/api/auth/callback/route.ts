import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { FeishuClient } from '@/lib/feishu';
import {
  normalizeReturnTo,
  verifyFeishuOAuthState,
  withSearchParams,
} from '@/lib/feishu-oauth';

function redirectToReturnPath(
  request: Request,
  returnTo: string,
  params: Record<string, string | null | undefined>
) {
  const nextPath = withSearchParams(returnTo, params);
  return NextResponse.redirect(new URL(nextPath, request.url));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateToken = searchParams.get('state');
  const oauthError = searchParams.get('error');
  const oauthErrorDescription = searchParams.get('error_description');
  let returnTo = '/';

  if (stateToken) {
    try {
      const state = await verifyFeishuOAuthState(stateToken);
      returnTo = normalizeReturnTo(state.returnTo);
    } catch {
      returnTo = '/';
    }
  }

  if (oauthError) {
    console.error(
      'Feishu OAuth authorization error:',
      oauthError,
      oauthErrorDescription
    );
    return redirectToReturnPath(request, returnTo, {
      feishuError: 'authorization-denied',
    });
  }

  if (!code || !stateToken) {
    return redirectToReturnPath(request, returnTo, {
      feishuError: 'missing-code',
    });
  }

  try {
    const state = await verifyFeishuOAuthState(stateToken);
    returnTo = normalizeReturnTo(state.returnTo);

    const session = await auth();
    const currentUserId = session?.user?.id;

    if (!currentUserId || currentUserId !== state.userId) {
      return redirectToReturnPath(request, returnTo, {
        feishuError: 'session-mismatch',
      });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        avatarUrl: true,
        email: true,
        id: true,
        name: true,
      },
    });

    if (!currentUser) {
      return redirectToReturnPath(request, '/login', {
        error: 'AccountNotFound',
      });
    }

    const client = new FeishuClient();
    const tokenData = await client.getUserAccessToken(code);
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token || !refresh_token || !expires_in) {
      throw new Error('Feishu token response is incomplete');
    }

    const userInfo = await client.getUserInfo(access_token);
    const feishuUserId = userInfo.open_id || tokenData.open_id;

    if (!feishuUserId) {
      throw new Error('Feishu did not return an open_id');
    }

    const linkedUser = await prisma.user.findFirst({
      where: { feishuUserId },
      select: { id: true },
    });

    if (linkedUser && linkedUser.id !== currentUserId) {
      return redirectToReturnPath(request, returnTo, {
        feishuError: 'already-bound',
      });
    }

    await prisma.user.update({
      where: { id: currentUserId },
      data: {
        avatarUrl: userInfo.avatar_url || currentUser.avatarUrl || undefined,
        encryptedAccessToken: encrypt(access_token),
        encryptedRefreshToken: encrypt(refresh_token),
        feishuUserId,
        name: currentUser.name || userInfo.name || currentUser.email || undefined,
        tokenExpiry: new Date(Date.now() + expires_in * 1000),
      },
    });

    return redirectToReturnPath(request, returnTo, {
      feishu: 'connected',
    });
  } catch (error) {
    console.error('Feishu callback error:', error);
    return redirectToReturnPath(request, returnTo, {
      feishuError: 'callback-failed',
    });
  }
}
