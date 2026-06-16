import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = requestUrl.searchParams.get('returnTo') || '/';
  return NextResponse.redirect(
    new URL(
      `/api/feishu/connect?returnTo=${encodeURIComponent(returnTo)}`,
      request.url
    )
  );
}
