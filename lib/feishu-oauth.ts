import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const secretKey = process.env.JWT_SECRET || 'secret';
const key = new TextEncoder().encode(secretKey);

interface FeishuOAuthState extends JWTPayload {
  userId: string;
  returnTo: string;
}

export function normalizeReturnTo(input: string | null | undefined): string {
  if (!input || !input.startsWith('/') || input.startsWith('//')) {
    return '/';
  }

  return input;
}

export function resolveFeishuRedirectUri(requestUrl: string): string {
  if (process.env.FEISHU_REDIRECT_URI) {
    return process.env.FEISHU_REDIRECT_URI;
  }

  const url = new URL(requestUrl);
  return `${url.origin}/api/auth/callback`;
}

export function withSearchParams(
  pathname: string,
  params: Record<string, string | null | undefined>
): string {
  const url = new URL(pathname, 'http://localhost');

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export async function createFeishuOAuthState(
  payload: FeishuOAuthState
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(key);
}

export async function verifyFeishuOAuthState(
  input: string
): Promise<FeishuOAuthState> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ['HS256'],
  });

  if (
    typeof payload.userId !== 'string' ||
    typeof payload.returnTo !== 'string'
  ) {
    throw new Error('Invalid Feishu OAuth state payload');
  }

  return {
    userId: payload.userId,
    returnTo: normalizeReturnTo(payload.returnTo),
  };
}

export function buildFeishuAuthorizationUrl(
  requestUrl: string,
  state: string
): string {
  const appId = process.env.FEISHU_APP_ID;

  if (!appId) {
    throw new Error('FEISHU_APP_ID is not configured');
  }

  const url = new URL('https://open.feishu.cn/open-apis/authen/v1/index');
  url.searchParams.set('app_id', appId);
  url.searchParams.set('redirect_uri', resolveFeishuRedirectUri(requestUrl));
  url.searchParams.set('state', state);

  return url.toString();
}
