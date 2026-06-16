'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Link2,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface FeishuStatusResponse {
  connected: boolean;
  avatarUrl?: string | null;
  displayName?: string | null;
  feishuUserId?: string | null;
  tokenExpiry?: string | null;
}

function getFeedbackMessage(
  feishuStatus: string | null,
  feishuError: string | null
) {
  if (feishuStatus === 'connected') {
    return {
      tone: 'success' as const,
      text: '飞书账号已绑定，后续转存会直接进入你的《我的文档库》。',
    };
  }

  if (!feishuError) {
    return null;
  }

  const errorTextMap: Record<string, string> = {
    'already-bound':
      '这个飞书账号已经绑定到另一个站内账号了，请换一个飞书账号重新授权。',
    'authorization-denied': '你取消了飞书授权，当前没有完成绑定。',
    'callback-failed': '飞书授权回调失败了，请稍后重试一次。',
    'missing-code': '飞书没有返回有效授权码，请重新发起绑定。',
    'session-mismatch': '站内登录状态已经变化，请重新登录后再次绑定飞书。',
  };

  return {
    tone: 'error' as const,
    text: errorTextMap[feishuError] || '飞书绑定没有完成，请重新尝试一次。',
  };
}

function formatTokenExpiry(input?: string | null) {
  if (!input) {
    return null;
  }

  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
}

export function FeishuConnectionCard() {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [status, setStatus] = useState<FeishuStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const feedback = getFeedbackMessage(
    searchParams.get('feishu'),
    searchParams.get('feishuError')
  );

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch('/api/feishu/status', { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load Feishu status');
        }

        if (!cancelled) {
          setStatus(data);
        }
      } catch {
        if (!cancelled) {
          setLoadError('当前无法读取飞书绑定状态，请稍后刷新页面再试。');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, [searchKey]);

  const connectHref = `/api/feishu/connect?returnTo=${encodeURIComponent('/')}`;
  const tokenExpiryText = formatTokenExpiry(status?.tokenExpiry);

  return (
    <section className="mb-6 rounded-3xl border border-black/[0.05] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-colors dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#EFF6FF] px-3 py-1 text-[12px] font-semibold text-[#1D4ED8] dark:bg-[#1D4ED8]/15 dark:text-[#93C5FD]">
            <Link2 className="h-3.5 w-3.5" />
            Feishu Connection
          </div>
          <h3 className="text-[20px] font-bold tracking-tight text-[#1d1d1f] dark:text-white">
            绑定飞书后，文档会进入你的《我的文档库》
          </h3>
          <p className="max-w-2xl text-[14px] leading-7 text-black/55 dark:text-white/55">
            这里绑定的是当前登录账号对应的飞书身份。后续点击“推送到飞书”时，文档会直接写入你自己的飞书云文档空间，而不是应用的公共空间。
          </p>
        </div>

        <div className="shrink-0">
          <a
            href={connectHref}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-black px-5 text-[14px] font-semibold text-white transition-colors hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
          >
            {status?.connected ? (
              <>
                <RefreshCw className="h-4 w-4" />
                重新授权
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4" />
                绑定飞书
              </>
            )}
          </a>
        </div>
      </div>

      {feedback && (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-[13px] ${
            feedback.tone === 'success'
              ? 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534] dark:border-[#166534]/40 dark:bg-[#052E16] dark:text-[#BBF7D0]'
              : 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] dark:border-[#7F1D1D]/50 dark:bg-[#450A0A] dark:text-[#FCA5A5]'
          }`}
        >
          <div className="flex items-start gap-2">
            {feedback.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <p>{feedback.text}</p>
          </div>
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-black/[0.05] bg-[#F8F8FA] p-4 dark:border-white/10 dark:bg-black/20">
        {isLoading ? (
          <div className="flex items-center gap-2 text-[14px] text-black/45 dark:text-white/45">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在读取飞书绑定状态...
          </div>
        ) : loadError ? (
          <div className="flex items-start gap-2 text-[14px] text-[#B45309] dark:text-[#FBBF24]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{loadError}</p>
          </div>
        ) : status?.connected ? (
          <div className="space-y-2 text-[14px] text-black/65 dark:text-white/65">
            <div className="flex items-center gap-2 font-medium text-[#166534] dark:text-[#86EFAC]">
              <CheckCircle2 className="h-4 w-4" />
              已连接飞书
            </div>
            <p>
              当前绑定账号: {status.displayName || status.feishuUserId || 'Feishu User'}
            </p>
            {tokenExpiryText && (
              <p className="text-[13px] text-black/45 dark:text-white/45">
                当前 access token 预计过期时间: {tokenExpiryText}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2 text-[14px] text-black/65 dark:text-white/65">
            <p className="font-medium text-[#92400E] dark:text-[#FCD34D]">
              还没有绑定飞书账号
            </p>
            <p className="text-black/50 dark:text-white/50">
              先完成一次飞书授权，再执行文章转存。这样转存出来的文档才会出现在你自己的飞书云文档里。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
