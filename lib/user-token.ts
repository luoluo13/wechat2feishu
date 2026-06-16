import { prisma } from './db';
import { decrypt, encrypt } from './encryption';
import { FeishuSyncError } from './feishu-errors';
import { FeishuClient } from './feishu';

export async function getValidUserAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || !user.encryptedAccessToken || !user.encryptedRefreshToken) {
    throw new FeishuSyncError(
      'FEISHU_BIND_REQUIRED',
      'Current account is not connected to Feishu yet.'
    );
  }

  if (user.tokenExpiry && user.tokenExpiry.getTime() - 5 * 60 * 1000 > Date.now()) {
    return decrypt(user.encryptedAccessToken);
  }

  console.log(`Refreshing token for user ${userId}...`);
  const refreshToken = decrypt(user.encryptedRefreshToken);
  const client = new FeishuClient();

  try {
    const data = await client.refreshUserAccessToken(refreshToken);
    const { access_token, refresh_token: nextRefreshToken, expires_in } = data;

    if (!access_token || !nextRefreshToken || !expires_in) {
      throw new FeishuSyncError(
        'FEISHU_REAUTHORIZE_REQUIRED',
        'Feishu authorization is missing a usable refresh token.'
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        encryptedAccessToken: encrypt(access_token),
        encryptedRefreshToken: encrypt(nextRefreshToken),
        tokenExpiry: new Date(Date.now() + expires_in * 1000),
      },
    });

    return access_token;
  } catch (error) {
    console.error('Refresh logic failed:', error);

    if (error instanceof FeishuSyncError) {
      throw error;
    }

    const message = error instanceof Error ? error.message.toLowerCase() : '';

    if (!message.includes('timeout') && !message.includes('network')) {
      throw new FeishuSyncError(
        'FEISHU_REAUTHORIZE_REQUIRED',
        'Feishu authorization expired or was revoked.'
      );
    }

    throw error;
  }
}
