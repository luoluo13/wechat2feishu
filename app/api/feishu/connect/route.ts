import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import {
  buildFeishuAuthorizationUrl,
  createFeishuOAuthState,
  normalizeReturnTo,
  withSearchParams,
} from '@/lib/feishu-oauth';

export async function GET(request: Request) {
  const session = await auth();
  const requestUrl = new URL(request.url);
  const returnTo = normalizeReturnTo(requestUrl.searchParams.get('returnTo'));
  const userId = session?.user?.id;

  if (!userId) {
    const loginUrl = withSearchParams('/login', {
      callbackUrl: returnTo,
      error: 'LoginRequired',
    });
    return NextResponse.redirect(new URL(loginUrl, request.url));
  }

  const state = await createFeishuOAuthState({ userId, returnTo });
  const authorizationUrl = buildFeishuAuthorizationUrl(request.url, state);

  return NextResponse.redirect(authorizationUrl);
}
