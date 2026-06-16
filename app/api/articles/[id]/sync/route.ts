import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { syncArticleToFeishu } from '@/lib/conductor';
import { prisma } from '@/lib/db';
import { isFeishuSyncError } from '@/lib/feishu-errors';

function buildConnectActionUrl(articleId: string) {
  return `/api/feishu/connect?returnTo=${encodeURIComponent(`/articles/${articleId}`)}`;
}

function buildUserFriendlySyncError(error: unknown, articleId: string) {
  if (isFeishuSyncError(error)) {
    if (error.code === 'FEISHU_BIND_REQUIRED') {
      return {
        status: 409,
        body: {
          code: error.code,
          error: error.message,
          userMessage:
            '请先绑定飞书账号，转存后的文档才会进入你的《我的文档库》。',
          detail: '完成授权后，再点击一次“推送到飞书”即可。',
          actionUrl: buildConnectActionUrl(articleId),
          actionLabel: '绑定飞书账号',
        },
      };
    }

    return {
      status: 401,
      body: {
        code: error.code,
        error: error.message,
        userMessage: '当前飞书授权已失效，请重新授权后再试。',
        detail: '重新授权不会影响你已经转存过的文档。',
        actionUrl: buildConnectActionUrl(articleId),
        actionLabel: '重新授权飞书',
      },
    };
  }

  const rawMessage =
    error instanceof Error ? error.message : 'Internal Server Error';
  const authUrlMatch = rawMessage.match(/https:\/\/open\.feishu\.cn\/\S+/);
  const scopeMatches = Array.from(rawMessage.matchAll(/\[([^\]]+)\]/g));
  const missingScopes = scopeMatches
    .flatMap((match) => match[1].split(','))
    .map((scope) => scope.trim())
    .filter((scope) => scope.includes(':'));

  if (
    rawMessage.includes('One of the following scopes is required') ||
    rawMessage.includes('Access denied')
  ) {
    const actionUrl = authUrlMatch?.[0] || buildConnectActionUrl(articleId);

    return {
      status: 403,
      body: {
        code: 'FEISHU_SCOPE_REQUIRED',
        error: rawMessage,
        userMessage: authUrlMatch
          ? '当前飞书应用缺少云空间权限，需要管理员先在飞书开放平台开通。'
          : '当前飞书授权缺少云空间访问能力，请重新授权后再试。',
        detail:
          missingScopes.length > 0
            ? `缺少权限: ${missingScopes.join(', ')}`
            : '请确认应用权限和用户授权都已经完成。',
        actionUrl,
        actionLabel: authUrlMatch ? '去开通飞书权限' : '重新授权飞书',
        missingScopes,
      },
    };
  }

  return {
    status: 500,
    body: {
      code: 'FEISHU_SYNC_FAILED',
      error: rawMessage,
      userMessage: '同步到飞书失败，请稍后重试。',
    },
  };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const article = await prisma.article.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!article || article.userId !== session.user.id) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const result = await syncArticleToFeishu(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('API Sync Error:', error);
    const { id } = await params;
    const friendlyError = buildUserFriendlySyncError(error, id);
    return NextResponse.json(friendlyError.body, {
      status: friendlyError.status,
    });
  }
}
